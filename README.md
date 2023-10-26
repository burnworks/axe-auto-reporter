# axe-auto-reporter

Automated accessibility testing script using @axe-core/puppeteer, outputting results as HTML. 

[@axe-core/puppeteer](https://github.com/dequelabs/axe-core-npm/blob/develop/packages/puppeteer/README.md) を使用して、テキストファイルで作成した URL リストに対して自動的にアクセシビリティテストを実行し、その結果を HTML ファイルとして保存するスクリプトです。

## Getting Started

Install Node.js if you haven't already.

```sh
git clone https://github.com/burnworks/axe-auto-reporter.git
cd axe-auto-reporter
npm install
```

### Edit `urls.txt`

Please edit `urls.txt` to create a list of URLs you wish to test. Separate each URL with a newline.

`urls.txt` を編集してテストを実行したい URL のリストを作ってください。URL は改行で区切ります。

### Run Tests

```sh
node axe-auto-reporter.mjs
```

When you run the test, a `results` directory will be created, and the test results will be stored inside. Tests are organized by the date and time they were executed, with HTML files saved in the `html` directory and JSON files in the `json` directory.

テストを実行すると `results` ディレクトリが作成され、その中にテスト結果が保存されます。テストは実行した日時ごとにディレクトリ分けされ、さらに HTML ファイルは `html` ディレクトリに、JSON ファイルは `json` ディレクトリに保存されます。JSON ファイルにはテスト結果のすべてが入っていますので、これを使用して他のデータを作ったりすることもできます。

## Configuration

The configuration file is config.mjs. You can set the following items:

| Property | Default | Description |
| -------- | ------- | ----------- |
| `urlList` | `urls.txt` | list of URLs. |
| `locale` | `ja` | `ja`（日本語） or `en` (English) |
| `tags` | `'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'` | Axe-core Tags setting. See. [Axe Javascript Accessibility API](https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags)
| `mode` | `pc` | `pc` or `mobile`. If you set the value to `pc`, the defaultViewport for puppeteer will be `width: 1024, height: 768`. If set to `mobile`, it will be `width: 375, height: 812`. |

## Caution !

Attempting to run automated tests on too many URLs may not work properly and has the potential to impose excessive load on the destination server. If this happens, please reduce the number of URLs in urls.txt.

あまりに多くの URL に対して自動テストを実行しようとするとうまく行かないかもしれませんし、接続先のサーバに過剰な負荷をかけてしまう可能性があります。その場合は `urls.txt` に入れる URL の数を減らすなどしてください。