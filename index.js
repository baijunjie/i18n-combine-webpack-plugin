const path = require('path')
const fs = require('fs-extra')
const globby = require('globby')
const chokidar = require('chokidar')
const _ = require('lodash')
const { sortKey, filterDeep } = require('./utils')

const defaultOptions = {
  base: '',
  src: '',
  dist: '',
  indentSize: 2,
  autoMerge: {
    target: '',
    files: [],
    suffix: '__<<<',
    safeMode: false
  }
}

module.exports = class {
  constructor(options) {
    this.options = _.defaultsDeep(options, defaultOptions)
    this.options.base = this.options.base || this.options.src.replace(/\/\*.*$/, '')
  }

  apply(compiler) {
    if (!this.options.src || !this.options.dist) return console.error('"src" and "dist" are required.')

    this.merge()

    if (compiler.options.mode === 'development') {
      chokidar.watch(this.options.src).on('change', () => {
        this.merge()
      })
    }
  }

  merge() {
    const {
      base,
      src,
      dist,
      autoMerge
    } = this.options

    const {
      target: mergeTarget,
      files: mergeFiles,
      suffix
    } = autoMerge

    return globby(src).then(files => {

      // 首先读取需要自动合并的语言文件
      const mergeJsonMap = {}
      if (mergeTarget && mergeFiles && mergeFiles.length) {
        for (const filename of mergeFiles) {
          const filePath = path.resolve(dist, filename)

          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            try {
              let json = JSON.parse(content)
              // 带后缀的 key 表示未翻译内容，因此不需要保留
              if (suffix) {
                json = filterDeep(json, (value, key) => {
                  return !key.endsWith(suffix)
                })
              }
              mergeJsonMap[filename] = json
            } catch (err) {
              console.error('Json format error: ' + filePath)
            }
          } catch (err) {
            mergeJsonMap[filename] = {}
          }
        }
      }

      // 合并源目录中所有语言文件，生成新的 JsonMap
      const i18nJsonMap = {}
      for (const filePath of files) {
        const relative = path.relative(base, filePath)
        const relativeParts = relative.split(/[\\,/]/)
        const filename = relativeParts.pop()
        const relativePath = relativeParts.join('.')
        const i18n = i18nJsonMap[filename] = i18nJsonMap[filename] || {}

        const content = fs.readFileSync(filePath, 'utf-8')
        if (content) {
          try {
            if (relativePath) {
              _.setWith(i18n, relativePath, JSON.parse(content), Object)
            } else {
              Object.assign(i18n, JSON.parse(content))
            }
          } catch (err) {
            throw new Error('Json format error: ' + relative)
          }
        }
      }

      // 将新的 JsonMap 与需要自动合并的语言文件进行合并
      for (const [ filename, json ] of Object.entries(i18nJsonMap)) {
        if (mergeJsonMap[filename]) {
          // 如果有自动合并的语言文件，这里只进行合并，暂不输出文件
          mergeJsonMap[filename] = _.merge(mergeJsonMap[filename], json)
        } else {
          // 如果没有自动合并的语言文件，则直接输出文件
          this.outputFile(filename, sortKey(json))
        }
      }

      // 当有合并目标时，才对需要自动合并的语言文件进行合并
      if (mergeTarget) {
        const mergeTargetJson = i18nJsonMap[mergeTarget]
        if (mergeTargetJson) {
          for (const [ filename, mergeJson ] of Object.entries(mergeJsonMap)) {
            if (!mergeJson) continue
            this.outputFile(filename, sortKey(this.mergeJson(mergeTargetJson, mergeJson)))
          }
        }
      }
    })
  }

  mergeJson(tar, src) {
    const { suffix, safeMode } = this.options.autoMerge

    const obj = {}
    for (const [ key, value ] of Object.entries(tar)) {
      const srcValue = src[key]

      if (srcValue === undefined) {
        obj[key + suffix] = value
        continue
      }

      if (_.isObject(value) && _.isObject(srcValue)) {
        obj[key] = this.mergeJson(value, srcValue)
      } else {
        obj[key] = srcValue
      }
    }

    if (safeMode) _.defaults(obj, src)
    return obj
  }

  outputFile(filename, json) {
    const { dist, indentSize } = this.options
    const filePath = path.resolve(dist, filename)
    fs.outputFileSync(filePath, JSON.stringify(json, null, indentSize))
  }
}
