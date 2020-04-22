const _ = require('lodash')

/**
 * 为对象的 key 排序，返回一个新对象
 * @param src
 * @returns {Object}
 */
module.exports.sortKey = function (src) {
  let arr = _.toPairs(src)
  arr = _.orderBy(arr, [0]).map(arr => {
    if (_.isObject(arr[1])) return [ arr[0], module.exports.sortKey(arr[1]) ]
    else return arr
  })
  return _.fromPairs(arr)
}


/**
 * 深遍历所有键值对，将返回值为 false 的键值对删除
 * @param src       {Object|Array} 数组或者对象
 * @param callback  {Function}     处理函数，会将 value key 与 path 传入
 * @param parentKey {String}       在递归中用于获取对象父级的 key
 * @returns {Object}
 */
module.exports.filterDeep = function (src, callback, parentKey = '') {
  const filterDeep = module.exports.filterDeep
  const newSrc = src instanceof Array ? [] : {}
  for (let [ key, value ] of Object.entries(src)) {
    const path = parentKey ? `${parentKey}.${key}` : key
    const returnValue = callback(value, key, path)
    if (!returnValue) continue
    if (value instanceof Object) value = filterDeep(value, callback, path)
    newSrc[key] = value
  }
  if (newSrc instanceof Array) return newSrc.filter(value => value !== undefined)
  else return newSrc
}
