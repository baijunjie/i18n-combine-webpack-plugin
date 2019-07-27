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
      indentSize,
      autoMerge
    } = this.options

    const {
      target: mergeTarget,
      files: mergeFiles,
      suffix
    } = autoMerge

    return globby(src).then(files => {

      const mergeJsonMap = {}
      if (mergeTarget && mergeFiles && mergeFiles.length) {
        for (const filename of mergeFiles) {
          const filePath = path.resolve(dist, filename)

          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            try {
              let json = JSON.parse(content)
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

      for (let [ filename, json ] of Object.entries(i18nJsonMap)) {
        if (mergeJsonMap[filename]) {
          mergeJsonMap[filename] = _.merge(mergeJsonMap[filename], json)
        } else {
          json = sortKey(json)
          const filePath = path.resolve(dist, filename)
          fs.outputFileSync(filePath, JSON.stringify(json, null, indentSize))
        }
      }

      if (mergeTarget) {
        const mergeTargetJson = i18nJsonMap[mergeTarget]
        for (const [ filename, mergeJson ] of Object.entries(mergeJsonMap)) {
          if (!mergeJson) continue
          const json = sortKey(this.mergeJson(mergeTargetJson, mergeJson))
          const filePath = path.resolve(dist, filename)
          fs.outputFileSync(filePath, JSON.stringify(json, null, indentSize))
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
}
