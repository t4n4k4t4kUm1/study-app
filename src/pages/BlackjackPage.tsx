// カジノのブラックジャック。チップを積んで配り、ヒット・スタンド・ダブルダウンで勝負する。
// 勝負そのものは DB の関数が進めるので、この画面は「ボタンを押したら DB に伝えて、返ってきた形を描く」だけ。
import { useEffect, useState } from 'react'
import {
  addChip,
  betError,
  cardName,
  CHIPS,
  handValue,
  isRed,
  MIN_BET,
  netOf,
  rankLabel,
  suitLabel,
  type BlackjackView,
  type Card,
} from '../lib/blackjack'
import type { BlackjackRepository } from '../lib/blackjackRepository'
import { formatCredits } from '../lib/credits'
import { href } from '../lib/router'

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' }

export function BlackjackPage({
  casino,
  balance,
  onCreditsChange,
}: {
  casino: BlackjackRepository
  balance: number | null // 右上と同じ残高。読み込み中は null
  onCreditsChange: () => void // 賭けた・戻ってきたときに、右上の残高を読み込み直す
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [round, setRound] = useState<BlackjackView | null>(null)
  const [bet, setBet] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 開いたときに、途中の勝負があれば続きから
  useEffect(() => {
    let cancelled = false
    casino
      .current()
      .then((view) => {
        if (cancelled) return
        setRound(view)
        if (view) setBet(view.bet)
        setLoad({ status: 'ready' })
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: e instanceof Error ? e.message : '読み込めませんでした' })
      })
    return () => {
      cancelled = true
    }
  }, [casino])

  // DB に操作を伝え、返ってきた勝負を表示する。どの操作でも残高が変わりうるので、右上も読み込み直す
  async function act(run: () => Promise<BlackjackView>) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      setRound(await run())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '通信に失敗しました')
    } finally {
      setBusy(false)
      onCreditsChange()
    }
  }

  if (load.status === 'loading') return <p className="muted">読み込み中…</p>
  if (load.status === 'error') return <p className="error">{load.message}</p>

  const playing = round?.status === 'playing'
  const available = balance ?? 0
  const dealError = betError(bet, available)

  return (
    <section className="casino">
      <h1>ブラックジャック</h1>
      <p className="muted">ブラックジャックは 3:2 ・ディーラーは 17 以上で止まる ・ダブルダウンあり</p>

      <div className="bj-table">
        {round ? (
          <>
            <Hand who="ディーラー" cards={round.dealer} />
            <Hand who="あなた" cards={round.player} />
            {round.status === 'finished' && <Result round={round} />}
          </>
        ) : (
          <p className="bj-empty">チップを積んで「配る」を押してください</p>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {playing && round ? (
        <div className="bj-actions">
          <button
            type="button"
            className="button primary"
            onClick={() => act(() => casino.hit(round.id))}
            disabled={busy}
          >
            ヒット
          </button>
          <button type="button" className="button" onClick={() => act(() => casino.stand(round.id))} disabled={busy}>
            スタンド
          </button>
          <button
            type="button"
            className="button"
            onClick={() => act(() => casino.double(round.id))}
            disabled={busy || round.player.length !== 2 || available < round.bet}
            title={available < round.bet ? 'クレジットが足りません' : undefined}
          >
            ダブルダウン（+{formatCredits(round.bet)}）
          </button>
          <p className="hint">賭け金 {formatCredits(round.bet)}</p>
        </div>
      ) : available < MIN_BET && balance !== null ? (
        <div className="bj-broke panel">
          <p>クレジットが {MIN_BET} 未満なので、賭けられません。</p>
          <a className="button primary" href={href({ name: 'home' })}>
            学習してクレジットを稼ぐ
          </a>
        </div>
      ) : (
        <div className="bj-bet">
          <div className="bj-chips" role="group" aria-label="チップ">
            {CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                className={`chip chip-${chip}`}
                onClick={() => setBet((b) => addChip(b, chip, available))}
                disabled={busy || bet + chip > available}
                aria-label={`${formatCredits(chip)} を積む`}
              >
                {formatCredits(chip)}
              </button>
            ))}
          </div>
          <p className="bj-bet-amount">
            賭け金 <strong>{formatCredits(bet)}</strong>
            <button type="button" className="link-button" onClick={() => setBet(0)} disabled={busy || bet === 0}>
              クリア
            </button>
          </p>
          <button
            type="button"
            className="button primary"
            onClick={() => act(() => casino.start(bet))}
            disabled={busy || dealError !== null}
          >
            配る
          </button>
          {bet > available && <p className="error">クレジットが足りません。賭け金を減らしてください</p>}
        </div>
      )}
    </section>
  )
}

// 手札と点数。ディーラーの伏せカード（null）は裏向きに描き、点数は見えているカードだけで数える
function Hand({ who, cards }: { who: string; cards: (Card | null)[] }) {
  const visible = cards.filter((c): c is Card => c !== null)
  const { total, soft } = handValue(visible)
  const hidden = visible.length < cards.length
  const label = soft && total < 21 ? `${total - 10} / ${total}` : `${total}`
  return (
    <div className="bj-hand" role="group" aria-label={`${who}の手札（${hidden ? '見えている分 ' : ''}${total}）`}>
      <div className="bj-hand-head">
        <span className="bj-who">{who}</span>
        <span className={`bj-total${total > 21 ? ' bust' : ''}`}>
          {label}
          {hidden && ' ＋ ?'}
        </span>
      </div>
      <div className="bj-cards">
        {cards.map((card, i) =>
          card === null ? (
            <span key={i} className="playing-card back" role="img" aria-label="伏せたカード" />
          ) : (
            <span key={i} className={`playing-card${isRed(card) ? ' red' : ''}`} role="img" aria-label={cardName(card)}>
              <span className="pc-rank">{rankLabel(card)}</span>
              <span className="pc-suit">{suitLabel(card)}</span>
            </span>
          ),
        )}
      </div>
    </div>
  )
}

function Result({ round }: { round: BlackjackView }) {
  const net = netOf(round)
  const player = handValue(round.player).total
  const dealer = handValue(round.dealer.filter((c): c is Card => c !== null)).total
  const title = {
    blackjack: 'ブラックジャック！',
    win: '勝ち！',
    push: '引き分け',
    lose: player > 21 ? 'バースト…' : '負け',
  }[round.outcome ?? 'lose']
  const reason =
    round.outcome === 'win' && dealer > 21
      ? 'ディーラーが 21 を超えました'
      : round.outcome === 'lose' && round.dealer.length === 2 && dealer === 21 && player <= 21
        ? 'ディーラーのブラックジャック'
        : null
  return (
    <div className={`bj-result ${net > 0 ? 'plus' : net < 0 ? 'minus' : 'even'}`} role="status">
      <span className="bj-result-title">{title}</span>
      <span className="bj-result-net">
        {net > 0 ? `+${formatCredits(net)}` : net < 0 ? `−${formatCredits(-net)}` : '±0'}
      </span>
      {reason && <span className="bj-result-reason">{reason}</span>}
    </div>
  )
}
