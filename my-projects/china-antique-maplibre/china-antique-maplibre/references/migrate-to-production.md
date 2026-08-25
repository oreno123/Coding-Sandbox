# 迁移到生产 MapLibre 场景

从 tuner 调好的预设 JSON，迁移到循舟记/任何 MapLibre 生产场景的清单。

## 输入：3 个文件

| 文件 | 来源 | 用途 |
|------|------|------|
| `tuner/presets/antique-yongji-canal.json` | tuner 导出 | 镜头 / 配色 / 山影 / 水系 / CSS 参数 |
| `tuner/assets/yongji-canal-sites.json` | 自建 16 城数据 | 城点 GeoJSON source |
| `tuner/camera-path-yongji.json` | 自建 9 帧路径 | jumpTo 关键帧序列 |

## 输出：生产 MapLibre 场景代码骨架（按步骤）

### 1. 初始化地图 + Terrarium DEM

```js
const map = new maplibregl.Map({
  container: 'map',
  style: presetJSON.maplibre.backgroundColor
    ? { version: 8, sources: {}, layers: [], glyphs: undefined }
    : 'https://demotiles.maplibre.org/style.json',
  center: presetJSON.camera.center,
  zoom: presetJSON.camera.zoom,
  pitch: presetJSON.camera.pitch,
  bearing: presetJSON.camera.bearing,
});

map.on('load', () => {
  // Terrarium DEM（必须 encoding: 'terrarium'）
  map.addSource('dem', {
    type: 'raster-dem',
    tiles: ['https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256,
    encoding: 'terrarium',
    maxzoom: 15,
  });
  map.setTerrain({ source: 'dem', exaggeration: presetJSON.maplibre.terrainExaggeration });

  // 卫星底图（EOX 或自换）
  map.addSource('satellite', {
    type: 'raster',
    tiles: ['https://s2maps.eu/wmts?...'],  // 见 tuner/map-tiles.config.js
    tileSize: 256,
  });
  map.addLayer({
    id: 'satellite',
    type: 'raster',
    source: 'satellite',
    paint: {
      'raster-opacity': presetJSON.maplibre.satellite.opacity,
      'raster-saturation': presetJSON.maplibre.satellite.saturation,
      'raster-contrast': presetJSON.maplibre.satellite.contrast,
      'raster-brightness-min': presetJSON.maplibre.satellite.brightnessMin,
      'raster-brightness-max': presetJSON.maplibre.satellite.brightnessMax,
      'raster-hue-rotate': presetJSON.maplibre.satellite.hueRotate,
    },
  });

  // 山影（hillshade layer）
  map.addLayer({
    id: 'hillshade',
    type: 'hillshade',
    source: 'dem',
    paint: {
      'hillshade-exaggeration': presetJSON.maplibre.hillshade.exaggeration,
      'hillshade-illumination-direction': presetJSON.maplibre.hillshade.illuminationDirection,
      'hillshade-shadow-color': presetJSON.maplibre.hillshade.shadowColor,
      'hillshade-highlight-color': presetJSON.maplibre.hillshade.highlightColor,
      'hillshade-accent-color': presetJSON.maplibre.hillshade.accentColor,
    },
  });

  // 水系 + 城点：见下文
});
```

### 2. 水系层（layer-by-layer）

水系 source 数据走 `china-antique-maplibre` 仓库的 `tuner/assets/water-data.js`（`CHINA_WATER_DATA`）。
**注意：水系数据非 MIT**——商用前看 `DATA-PROVENANCE.md`，自建数据走自建 GeoJSON source。

每层 `line-color` / `line-width` 直接读 `presetJSON.maplibre.water`：
- `riverLevel3` → 三级支流
- `riverLevel2` → 二级支流
- `riverLevel1` → 主流
- `highlightRiver` → 叙事高亮河（永济渠本体）

### 3. 城点（fill-extrusion）

把 `yongji-canal-sites.json` 转 GeoJSON：

```js
const sitesGeoJSON = {
  type: 'FeatureCollection',
  features: sitesJSON.map(s => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
    properties: s,
  })),
};

map.addSource('sites', { type: 'geojson', data: sitesGeoJSON });

// tier → halfKm 映射（按 city-tier-schema.md）
const tierHalfKm = {
  capital: 30, large: 22, medium: 18, small: 10, pass: 8, station: 4, ordos: 16,
};

map.addLayer({
  id: 'sites-extrusion',
  type: 'fill-extrusion',
  source: 'sites',
  paint: {
    'fill-extrusion-color': '#7a2018',  // 朱漆
    'fill-extrusion-height': [
      'interpolate', ['linear'], ['zoom'],
      4, 200,
      10, 800,
    ],
    'fill-extrusion-base': 0,
  },
});
// 用 tier 调宽度（halfKm 不能直接用，需要在 client-side 算 footprint polygon）
```

或者更简单：用 `circle` layer + 透视拉伸的 sprite。

### 4. CSS 古卷滤镜（套在 map canvas wrapper 上）

```js
const css = presetJSON.css;
const filter = [
  `sepia(${css.sepia})`,
  `saturate(${css.saturate})`,
  `contrast(${css.contrast})`,
  `brightness(${css.brightness})`,
  `hue-rotate(${css.hueRotate}deg)`,
].join(' ');

document.querySelector('.maplibregl-canvas-container').style.filter = filter;

// 暖色叠加（::after 伪元素 + soft-light mix-blend-mode）
// 暗角（::before 伪元素 + radial-gradient）
```

### 5. 镜头路径（jumpTo + idle，禁止 flyTo/easeTo）

```js
const path = cameraPathJSON.frames;

async function playFrame(i) {
  if (i >= path.length) return;
  const f = path[i];
  map.jumpTo({
    center: f.center,
    zoom: f.zoom,
    pitch: f.pitch,
    bearing: f.bearing,
  });
  await new Promise(resolve => {
    map.once('idle', resolve);
    // 超时兜底（瓦片挂掉）
    setTimeout(resolve, cameraPathJSON.rules.frameHoldMs);
  });
  await new Promise(r => setTimeout(r, cameraPathJSON.rules.frameHoldMs));
  playFrame(i + 1);
}

playFrame(0);
```

**为什么禁 flyTo/easeTo：** 录制镜头需要逐帧稳定，flyTo 的中间帧受系统帧率/网络/可视区域影响，跨次录制结果不一致。jumpTo + idle 保证每帧瓦片加载完毕才进下一帧。

## 录制建议（外部）

- 用 [Puppeteer](https://pptr.dev/) headless Chromium，每帧 `page.screenshot()`
- 或 OBS Studio 录屏 + 后期抽帧
- 帧率建议 30 fps，单镜头 4-6 秒（120-180 帧）

## 检查清单

- [ ] 卫星底图换成自购源（EOX 默认非商用）
- [ ] 水系数据来源已确认（自建 / china-antique-maplibre 仓库的 `water-data.js` 注意非 MIT）
- [ ] Terrarium DEM `encoding: 'terrarium'` 已设置
- [ ] 镜头序列用 `jumpTo + idle`，无 `flyTo/easeTo`
- [ ] CSS filter 套在 canvas 容器上，不是 body
- [ ] 城点 GeoJSON 经纬度已核（隋代地名 ≠ 现代地名，点位用现代坐标）
- [ ] 暗角 / 暖色叠加在地图层之上，不影响 UI 控件
