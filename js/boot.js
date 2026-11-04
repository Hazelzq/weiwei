/*
 * 启动脚本（普通脚本，非模块）。
 * GitHub Pages 只托管静态文件，Three.js 从公共 CDN 读取。
 * 依次探测：本地 vendor/three（可选，见 README）→ jsDelivr → npmmirror → unpkg，
 * 用最先响应的一个生成 import map，再加载页面入口模块。
 */
(function () {
  var VERSION = '0.185.1';
  var script = document.currentScript;
  var entry = script.getAttribute('data-entry');
  var bases = [
    'vendor/three/',
    'https://cdn.jsdelivr.net/npm/three@' + VERSION + '/',
    'https://registry.npmmirror.com/three/' + VERSION + '/files/',
    'https://unpkg.com/three@' + VERSION + '/'
  ];
  function probe(base) {
    return new Promise(function (resolve, reject) {
      var controller = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (controller) controller.abort(); reject(); }, 6000);
      fetch(base + 'build/three.module.js', { method: 'HEAD', signal: controller && controller.signal })
        .then(function (r) { clearTimeout(timer); r.ok ? resolve(base) : reject(); },
              function () { clearTimeout(timer); reject(); });
    });
  }
  function fail() {
    var box = document.getElementById('loading');
    if (box) box.textContent = '3D 组件没有加载成功，请检查网络后刷新页面。';
  }
  function any(list) {
    return new Promise(function (resolve, reject) {
      var left = list.length;
      list.forEach(function (p) { p.then(resolve, function () { if (--left === 0) reject(); }); });
    });
  }
  // 翻页时每一页都会重新加载：记住上次可用的地址，直接用，省掉 4 次探测（最多等 6 秒）
  var cached = null;
  try { cached = sessionStorage.getItem('three-base'); } catch (e) { /* 忽略 */ }
  var found = cached ? Promise.resolve(cached) : any(bases.map(probe));
  found.then(function (base) {
    try { sessionStorage.setItem('three-base', base); } catch (e) { /* 忽略 */ }
    var map = document.createElement('script');
    map.type = 'importmap';
    // import map 里的地址必须是完整网址（或以 / ./ ../ 开头），本地的 vendor/three/ 要先换成完整网址
    var abs = new URL(base, location.href).href;
    map.textContent = JSON.stringify({ imports: {
      three: abs + 'build/three.module.js',
      'three/addons/': abs + 'examples/jsm/'
    } });
    document.head.appendChild(map);
    var main = document.createElement('script');
    main.type = 'module';
    main.src = entry;
    main.onerror = function () {
      // 记住的地址失效了：清掉再重新探测一次
      try { if (cached) { sessionStorage.removeItem('three-base'); location.reload(); return; } } catch (e) { /* 忽略 */ }
      fail();
    };
    document.head.appendChild(main);
  }, fail);
})();
