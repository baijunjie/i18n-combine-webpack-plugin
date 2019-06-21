const path = require('path')
const fs = require('fs-extra')
const globby = require('globby')
const chokidar = require('chokidar')

const defaultOptions = {
    base: '',
    src: '',
    dist: ''
}

module.exports = class {
    constructor(options) {
        const { base, src, dist } = Object.assign(defaultOptions, options)
        this.base = base || src.replace(/\/\*.*$/, '')
        this.src = src
        this.dist = dist
    }

    apply(compiler) {
        if (!this.src || !this.dist) return;

        this.merge()

        if (compiler.options.mode === 'development') {
            chokidar.watch(this.src).on('change', () => {
                this.merge()
            })
        }
    }

    merge() {
        return globby(this.src).then(files => {
            const i18nFiles = {}

            for (let filePath of files) {
                const relative = path.relative(this.base, filePath)
                const relativeParts = relative.split(/[\\,/]/);
                const filename = relativeParts.pop();

                let i18n = i18nFiles[filename] = i18nFiles[filename] || {}
                relativeParts.forEach(value => {
                    i18n = i18n[value] = i18n[value] || {}
                })

                let content = fs.readFileSync(filePath, 'utf-8')
                if (content) {
                    try {
                        Object.assign(i18n, JSON.parse(content));
                    } catch (err) {
                        throw new Error('Json format error: ' + relative);
                    }
                }
            }

            for (let [filename, content] of Object.entries(i18nFiles)) {
                fs.outputFileSync(path.resolve(this.dist, filename), JSON.stringify(content))
            }
        })
    }
}