// アニメーションの「動き方」をまとめた置き場。どの画面も同じ動き方を使うので、アプリ全体の手ざわりがそろう。
// ここにあるのは見た目の決まりだけで、学習の判断（src/lib）とは関係しない。
import type { Transition, Variants } from 'motion/react'

/** ばね：止まるときに少しだけ行き過ぎて戻る。ボタンやカードの動きに使う */
export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 }
/** ゆっくりしたばね：カードをめくる、パネルが出てくる */
export const softSpring: Transition = { type: 'spring', stiffness: 220, damping: 26 }
/** すっと消える：消えるときは速く、目が次へ移れるように */
export const quickOut: Transition = { duration: 0.16, ease: [0.4, 0, 1, 1] }

/** 画面の切り替え：下から浮かび上がり、ぼかしが晴れる。消えるときは少し上へ */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { ...softSpring, staggerChildren: 0.04 } },
  exit: { opacity: 0, y: -8, filter: 'blur(4px)', transition: quickOut },
}

/** 一覧：中の項目が少しずつ遅れて順番に出てくる */
export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
}
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring },
}

/** 不正解のときの「ぶるっ」と横に震える動き */
export const shake = { x: [0, -10, 10, -7, 7, -3, 0], transition: { duration: 0.42 } }
