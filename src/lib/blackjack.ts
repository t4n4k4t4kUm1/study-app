// ブラックジャックの決まり（ルールブック）。
// 本当の勝負は DB の関数（supabase/migrations/20261016150000_blackjack.sql）の中で進む。画面から勝ち負けを送っても信じない。
// ここには同じ決まりを書いておき、テストで確かめたり、テスト用のメモリ版リポジトリで使ったりする。
//
// このアプリのルール
//   - 6デッキ（312枚）を勝負ごとに切り直す
//   - ブラックジャック（最初の2枚で21）は 3:2（100賭けたら 250 戻る）
//   - ディーラーは 17 以上で止まる（A を 11 と数えた 17＝ソフト17 でも止まる）
//   - 最初にディーラーもブラックジャックか確かめ、そうならすぐ決着（ピーク）
//   - ダブルダウン：最初の2枚のときだけ。賭け金を倍にして1枚だけ引き、自動で止まる
//   - 21 になったら自動で止まる
//   - 賭け金は 100 単位

/** 1枚のカード。0〜51 の番号（6デッキ分でも 52 で割った余りで表す）。13枚ごとに ♠ ♥ ♦ ♣ */
export type Card = number

export const MIN_BET = 100
export const BET_UNIT = 100
export const CHIPS = [100, 500, 1000, 5000] as const
export const DECKS = 6

/** 1（A）〜13（K） */
export const rankOf = (card: Card) => ((card % 52) % 13) + 1
/** 0：♠ 1：♥ 2：♦ 3：♣ */
export const suitOf = (card: Card) => Math.floor((card % 52) / 13)

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const SUIT_LABELS = ['♠', '♥', '♦', '♣']
const SUIT_NAMES = ['スペード', 'ハート', 'ダイヤ', 'クラブ']
export const rankLabel = (card: Card) => RANK_LABELS[rankOf(card) - 1]
export const suitLabel = (card: Card) => SUIT_LABELS[suitOf(card)]
/** 読み上げ用。「ハートのA」 */
export const cardName = (card: Card) => `${SUIT_NAMES[suitOf(card)]}の${rankLabel(card)}`
export const isRed = (card: Card) => suitOf(card) === 1 || suitOf(card) === 2

/**
 * 手の点数。J・Q・K は 10。A はまず 1 と数え、11 にしても 21 を超えないなら 11 にする。
 * soft：A を 11 と数えているか（もう1枚引いても絶対に 21 を超えない手）
 */
export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0
  let aces = 0
  for (const card of cards) {
    const rank = rankOf(card)
    total += Math.min(rank, 10)
    if (rank === 1) aces += 1
  }
  if (aces > 0 && total + 10 <= 21) return { total: total + 10, soft: true }
  return { total, soft: false }
}

export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21

/** blackjack：3:2 で勝ち / win：勝ち / push：引き分け / lose：負け */
export type Outcome = 'blackjack' | 'win' | 'push' | 'lose'

/** 勝負の全部（DB の blackjack_rounds の1行）。山札とディーラーの伏せカードを含むので、画面にはこのまま渡さない */
export type Round = {
  bet: number // 最初に賭けた額
  doubled: boolean
  deck: Card[] // 切り直した山札（上から順に配る）
  next: number // 次に配るカードの位置
  player: Card[]
  dealer: Card[]
  status: 'playing' | 'finished'
  outcome: Outcome | null
  payout: number // 戻ってくる額（賭け金を含む）。負けなら 0
}

/** 賭けている額（ダブルダウンしたら2倍） */
export const stakeOf = (round: Pick<Round, 'bet' | 'doubled'>) => round.bet * (round.doubled ? 2 : 1)

/** 賭け金として正しいか。正しくなければ理由を返す */
export function betError(bet: number, balance: number): string | null {
  if (!Number.isInteger(bet) || bet < MIN_BET) return `賭け金は ${MIN_BET} 以上にしてください`
  if (bet % BET_UNIT !== 0) return `賭け金は ${BET_UNIT} 単位にしてください`
  if (bet > balance) return 'クレジットが足りません'
  return null
}

/** チップを1枚積む。所持金を超えるなら積まない */
export function addChip(bet: number, chip: number, balance: number): number {
  return bet + chip <= balance ? bet + chip : bet
}

/** 6デッキを切り直した山札を作る。random は 0 以上 1 未満を返す関数（テストでは決まった数を返すものに替えられる） */
export function shuffledShoe(random: () => number = Math.random): Card[] {
  const shoe = Array.from({ length: 52 * DECKS }, (_, i) => i % 52)
  // フィッシャー–イェーツのシャッフル：後ろから順に、まだ決まっていない中から1枚を選んで入れ替える
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shoe[i], shoe[j]] = [shoe[j], shoe[i]]
  }
  return shoe
}

function draw(round: Round): [Card, Round] {
  const card = round.deck[round.next]
  if (card === undefined) throw new Error('山札がなくなりました')
  return [card, { ...round, next: round.next + 1 }]
}

/** 勝負を始める。プレイヤー → ディーラー → プレイヤー → ディーラー の順に配る */
export function startRound(bet: number, deck: Card[]): Round {
  let round: Round = {
    bet,
    doubled: false,
    deck,
    next: 0,
    player: [],
    dealer: [],
    status: 'playing',
    outcome: null,
    payout: 0,
  }
  for (const who of ['player', 'dealer', 'player', 'dealer'] as const) {
    const [card, rest] = draw(round)
    round = { ...rest, [who]: [...rest[who], card] }
  }
  // どちらかがブラックジャックなら、その場で決着（ディーラーは引かない）
  if (isBlackjack(round.player) || isBlackjack(round.dealer)) return settle(round)
  return round
}

/** もう1枚引く。21 を超えたら負け、ちょうど 21 なら自動で止まる */
export function hit(round: Round): Round {
  if (round.status !== 'playing') throw new Error('この勝負はもう終わっています')
  const [card, rest] = draw(round)
  const next = { ...rest, player: [...rest.player, card] }
  const total = handValue(next.player).total
  if (total > 21) return settle(next)
  if (total === 21) return stand(next)
  return next
}

/** 止める。ディーラーが 17 以上になるまで引いてから勝ち負けを決める */
export function stand(round: Round): Round {
  if (round.status !== 'playing') throw new Error('この勝負はもう終わっています')
  let next = round
  while (handValue(next.dealer).total < 17) {
    const [card, rest] = draw(next)
    next = { ...rest, dealer: [...rest.dealer, card] }
  }
  return settle(next)
}

/** ダブルダウンできるか（最初の2枚のときだけ） */
export const canDouble = (round: Pick<Round, 'status' | 'player'>) =>
  round.status === 'playing' && round.player.length === 2

/** ダブルダウン：賭け金を倍にして1枚だけ引き、自動で止まる */
export function double(round: Round): Round {
  if (!canDouble(round)) throw new Error('ダブルダウンは最初の2枚のときだけできます')
  const [card, rest] = draw({ ...round, doubled: true })
  const next = { ...rest, player: [...rest.player, card] }
  if (handValue(next.player).total > 21) return settle(next)
  return stand(next)
}

/** 勝ち負けと、戻ってくる額を決める */
function settle(round: Round): Round {
  const stake = stakeOf(round)
  const player = handValue(round.player).total
  const dealer = handValue(round.dealer).total
  let outcome: Outcome
  if (isBlackjack(round.player)) outcome = isBlackjack(round.dealer) ? 'push' : 'blackjack'
  else if (isBlackjack(round.dealer)) outcome = 'lose'
  else if (player > 21) outcome = 'lose'
  else if (dealer > 21 || player > dealer) outcome = 'win'
  else if (player === dealer) outcome = 'push'
  else outcome = 'lose'
  const payout = { blackjack: (stake * 5) / 2, win: stake * 2, push: stake, lose: 0 }[outcome]
  return { ...round, status: 'finished', outcome, payout }
}

/** 画面に見せてよい形。勝負の途中は、山札とディーラーの2枚目（伏せカード）を隠す（null） */
export type BlackjackView = {
  id: string
  bet: number
  doubled: boolean
  status: 'playing' | 'finished'
  player: Card[]
  dealer: (Card | null)[]
  outcome: Outcome | null
  payout: number
}

export function viewOf(id: string, round: Round): BlackjackView {
  return {
    id,
    bet: round.bet,
    doubled: round.doubled,
    status: round.status,
    player: round.player,
    dealer: round.status === 'playing' ? [round.dealer[0], null] : round.dealer,
    outcome: round.outcome,
    payout: round.payout,
  }
}

/** 勝負の結果で、残高がいくら増えた（減った）か。賭けた分を引いた差し引き */
export const netOf = (view: Pick<BlackjackView, 'bet' | 'doubled' | 'payout'>) => view.payout - stakeOf(view)
