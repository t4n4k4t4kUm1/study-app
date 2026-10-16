// テストの共通設定：toHaveTextContent などの DOM 用の判定を使えるようにし、
// テストごとに画面を片付ける
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach } from 'vitest'

// テストではアニメーションを待たずに、いきなり最後の状態にする（動きそのものはブラウザで確かめる）
MotionGlobalConfig.skipAnimations = true

afterEach(() => cleanup())
