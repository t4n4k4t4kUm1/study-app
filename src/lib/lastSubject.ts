// 前回保存した科目を覚えておき、次の入力の初期値にする。
// 同じ授業中に続けて保存することが多いため。
// ブラウザの localStorage を使うが、使えない環境（プライベートモードなど）でも落ちないようにする。

const KEY = 'study-app:last-subject'

export function loadLastSubject(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function saveLastSubject(subject: string): void {
  try {
    localStorage.setItem(KEY, subject)
  } catch {
    // 保存できなくても動作には影響しない
  }
}
