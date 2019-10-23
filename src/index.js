'use strict'

class HlsjsSwarmLoader {
  constructor(config) {
    this.bzz = config.bzz
    this.hash = config.bzzHash
    if (config.debug === false) {
      this.debug = function () { }
    } else if (config.debug === true) {
      this.debug = console.log
    } else {
      this.debug = config.debug
    }
    if (config.m3u8provider) {
      this.m3u8provider = config.m3u8provider;
    } else {
      this.m3u8provider = null;
    }
    if (config.tsListProvider) {
      this.tsListProvider = config.tsListProvider;
    } else {
      this.tsListProvider = null;
    }
  }

  destroy() {
  }

  abort() {
  }

  load(context, config, callbacks) {
    this.context = context
    this.config = config
    this.callbacks = callbacks
    this.stats = { trequest: performance.now(), retry: 0 }
    this.retryDelay = config.retryDelay
    this.loadInternal()
  }
  /**
   * Call this by getting the HLSSwarmLoader instance from hls.js hls.coreComponents[0].loaders.manifest.setM3U8Provider()
   * @param {function} provider 
   */
  setM3U8Provider(provider) {
    this.m3u8provider = provider;
  }
  /**
   * 
   * @param {function} provider 
   */
  setTsListProvider(provider) {
    this.tsListProvider = provider;
  }

  loadInternal() {
    const { stats, context, config, callbacks } = this

    stats.tfirst = Math.max(performance.now(), stats.trequest)
    stats.loaded = 0

    const urlParts = context.url.split("/")
    const filename = urlParts[urlParts.length - 1]

    if (filename.split(".")[1] === "m3u8" && this.m3u8provider !== null) {
      const res = this.m3u8provider();
      let data;
      if (Buffer.isBuffer(res)) {
        data = buf2str(res)
      } else {
        data = res;
      }
      const response = { url: context.url, data: data }
      callbacks.onSuccess(response, stats, context)
      return;
    }
    if (filename.split(".")[1] === "m3u8" && this.tsListProvider !== null) {
      var tslist = this.tsListProvider();
      var hash = tslist[filename];
      if (hash) {
        this.cat(hash).then(res => {
          let data;
          if (Buffer.isBuffer(res)) {
            data = buf2str(res)
          } else {
            data = res;
          }
          stats.loaded = stats.total = data.length
          stats.tload = Math.max(stats.tfirst, performance.now())
          const response = { url: context.url, data: data }
          callbacks.onSuccess(response, stats, context)
        });
      }
      return;
    }
    getFile(this.bzz, this.hash, filename, this.debug).then(res => {
      const data = (context.responseType === 'arraybuffer') ? res : buf2str(res)
      stats.loaded = stats.total = data.length
      stats.tload = Math.max(stats.tfirst, performance.now())
      const response = { url: context.url, data: data }
      callbacks.onSuccess(response, stats, context)
    }, console.error)
  }
}

function getFile(bzz, rootHash, filename, debug) {
  debug(`Fetching hash for '${rootHash}/${filename}'`)
  if (filename === null) {
    return bzz.download(rootHash).then(value => {
      debug(`Received data for file '${rootHash}' size: ${value.size}`)
      return value
    });
  }
  return bzz.list(rootHash).then(res => {
    const link = res.entries.find(({ path }) => (path === filename))

    if (link === undefined) {
      throw new Error(`File not found: ${rootHash}/${filename}`)
    }

    debug(`Requesting '${link.path}'`)

    return bzz.download(link.hash, { mode: 'raw' }).then(res => {
      return res.arrayBuffer().then(value => {
        debug(`Received data for file '${link.path}' size: ${link.size}`)
        return value
      })
    })
  })
}

function buf2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf))
}

exports = module.exports = HlsjsSwarmLoader
