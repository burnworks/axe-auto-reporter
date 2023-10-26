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

### Run Tests

```sh
node axe-auto-reporter.mjs
```

When you run the test, a result directory will be created, and the test results will be stored inside. Tests are organized by the date and time they were executed, with HTML files saved in the html directory and JSON files in the json directory.

## Configuration

The configuration file is config.mjs. You can set the following items:

| Property | Default | Description |
| -------- | ------- | ----------- |
| `urlList` | `urls.txt` | list of URLs. |
| `locale` | `ja` | `ja`（日本語） or `en` (English) |
| `tags` | `'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'` | Axe-core Tags setting. See. [Axe Javascript Accessibility API](https://github.com/dequelabs/axe-core/blob/master/doc/API.md#axe-core-tags)
| `mode` | `pc` | `pc` or `mobile`. If you set the value to `pc`, the defaultViewport for puppeteer will be `width: 1024, height: 768`. If set to `mobile`, it will be `width: 375, height: 812`. |
