// テストの共通設定：toHaveTextContent などの DOM 用の判定を使えるようにし、
// テストごとに画面を片付ける
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
