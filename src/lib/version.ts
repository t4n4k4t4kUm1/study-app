// アプリのバージョン（例：0.11.0）。package.json の version を、ビルドのときに vite.config.ts が埋め込む。
// package.json をまるごと画面のコードに取り込むと、使っている部品の一覧まで公開されてしまうので、番号だけを渡している。
declare const __APP_VERSION__: string

export const APP_VERSION: string = __APP_VERSION__
