const path = require('path')
const fs = require('fs-extra')
const globby = require('globby')
const chokidar = require('chokidar')
const _ = require('lodash')

const defaultOptions = {
  base: '',
  src: '',
  dist: '',
  indentSize: 2,
  autoMerge: {
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
    return globby(this.options.src).then(files => {

      const mergeFileMap = {}
      const mergeFiles = this.options.autoMerge.files
      if (mergeFiles && mergeFiles.length) {
        for (const filename of this.options.autoMerge.files) {
          const filePath = path.resolve(this.options.dist, filename)

          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            try {
              mergeFileMap[filename] = JSON.parse(content)
            } catch (err) {
              console.error('Json format error: ' + filePath)
            }
          } catch (err) {
            mergeFileMap[filename] = {}
          }
        }
      }

      const i18nFileMap = {}
      for (const filePath of files) {
        const relative = path.relative(this.options.base, filePath)
        const relativeParts = relative.split(/[\\,/]/)
        const filename = relativeParts.pop()
        const relativePath = relativeParts.join('.')
        const i18n = i18nFileMap[filename] = i18nFileMap[filename] || {}

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

      for (let [ filename, json ] of Object.entries(i18nFileMap)) {
        json = objSort(json)

        const filePath = path.resolve(this.options.dist, filename)
        fs.outputFileSync(filePath, JSON.stringify(json, null, this.options.indentSize))

        for (const [ filename, mergeFile ] of Object.entries(mergeFileMap)) {
          if (!mergeFile) continue
          const mergeFilePath = path.resolve(this.options.dist, filename)

          const newJson = objSort(this.mergeJson(json, mergeFile))
          fs.outputFileSync(mergeFilePath, JSON.stringify(newJson, null, this.options.indentSize))
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

function objSort(obj) {
  let arr = _.toPairs(obj)
  arr = _.orderBy(arr, [0]).map(arr => {
    if (_.isObject(arr[1])) return [ arr[0], objSort(arr[1]) ]
    else return arr
  })
  return _.fromPairs(arr)
}
