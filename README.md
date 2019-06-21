# i18n-combine-webpack-plugin

### Install

```sh
$ npm install i18n-combine-webpack-plugin
# or
$ yarn add i18n-combine-webpack-plugin
```

### Directory Structure

```
└── src
    ├── components
    │   ├── header.vue
    │   ├── footer.vue
    │   ├── en-US.json
    │   └── zh-CN.json
    └── views
        ├── home
        │   ├── home.vue
        │   ├── en-US.json
        │   └── zh-CN.json
        ├── foo
        │   ├── foo.vue
        │   ├── en-US.json
        │   └── zh-CN.json
        └── bar
            ├── bar.vue
            ├── en-US.json
            └── zh-CN.json
```

### Single Files Content

`src/components/zh-CN.json`

```json
{
  "header": "头部",
  "footer": "脚部"
}
```

`src/pages/foo/zh-CN.json`

```json
{
  "name": "foo",
  "title": "欢迎来到 Foo"
}
```

### Webpack Config

```js
const I18nCombineWebpackPlugin = require('i18n-combine-webpack-plugin')
const path = require('path')

module.exports = {
  ...
  plugins: [
    ...
    new I18nCombineWebpackPlugin({
      src: path.join(__dirname, './src/**/*.json'),
      dist: path.join(__dirname, './dist/data/i18n')
    })
  ]
}
```

### Output

Output directory

```
└── dist
    └── i18n
        ├── en-US.json
        └── zh-CN.json
```

`dist/i18n/zh-CN.json`

```json
{
  "components": {
    "header": "头部",
    "footer": "脚部"
  },
  "views": {
    "home": {
      "name": "home",
      "title": "欢迎来到 Home"
    },
    "foo": {
      "name": "foo",
      "title": "欢迎来到 Foo"
    },
    "bar": {
      "name": "bar",
      "title": "欢迎来到 Bar"
    }
  }
}
```

