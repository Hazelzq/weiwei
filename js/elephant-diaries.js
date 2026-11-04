// 八只小象和它们的日记。
// 顺序就是绕树走的顺序：每只小象用鼻子拉着前面那只的尾巴，阿团又拉着小石头的尾巴，正好围成一圈。
//
// 想换日记下面的景色图：把照片放进 assets/diary/ 文件夹，再把对应日记的 photo 改成文件名，
// 例如 photo: 'assets/diary/fog.jpg'。photo 为空时，页面会自己画一张安静的风景（scene 决定画什么）。
// scene 可选：branches 枝桠与天空、mist 雾里的湖、canopy 抬头看树叶、rain 雨天水面、grass 起风的草坡、
// fireflies 萤火虫、rainbow 雨后彩虹、clouds 大朵的云、stars 星空、moon 月亮。

export const ELEPHANTS = [
  {
    id: 'atuan', name: '阿团', crown: 'red', tusk: true, tint: 0,
    diaries: [
      {
        no: 17, date: '2026年10月26日', weather: '晴，风从东边来', mood: '有点骄傲',
        text: '今天我带大家绕着大树走了一百圈。我们走成一个圆，我拉着小石头的尾巴，豆豆拉着我的尾巴，所以谁也不是最后一只。',
        happy: '大树掉下来一片金色的叶子，正好落在我的王冠上，大家都说好看。',
        worry: '我的王冠是红色的，下雨的时候会不会褪色呀？我偷偷看了好几次。',
        scene: 'branches', opts: { leaf: true }, photo: '',
      },
      {
        no: 18, date: '2026年10月30日', weather: '多云，傍晚起了雾', mood: '暖暖的',
        text: '雾来的时候，前面的小象都看不清了。我就一边走一边数：一、二、三……一直数到八，大家就都还在。',
        happy: '数到“八”的时候，大家一起答了一声“在！”，把树上睡觉的鸟都吵醒了。',
        worry: '我只有一颗象牙，另一颗什么时候才长出来呢。',
        scene: 'mist', opts: {}, photo: '',
      },
    ],
  },
  {
    id: 'doudou', name: '豆豆', crown: 'gold', tint: 1,
    diaries: [
      {
        no: 9, date: '2026年10月24日', weather: '晴转多云', mood: '先是哭，后来笑了',
        text: '今天走路的时候，我踩到了大树的树根，“扑通”一声摔了一跤，鼻子先着的地。大家都停下来等我，阿团用鼻子把我扶了起来。',
        happy: '摔倒的地方软软的，长满了青苔，一点都不疼。',
        worry: '膝盖上沾了一块绿绿的东西，洗了三遍还在。',
        scene: 'grass', opts: { calm: true }, photo: '',
      },
      {
        no: 10, date: '2026年10月29日', weather: '大风，叶子哗啦啦地响', mood: '很勇敢',
        text: '风把我的耳朵吹得像两面旗子，我差点以为自己要飞起来了。我把四只脚踩得稳稳的，今天一次都没有摔倒！',
        happy: '我给自己发了一朵小红花。',
        worry: '耳朵被风吹得翻了过去，我自己翻不回来，是星星帮我翻回来的。',
        scene: 'grass', opts: { wind: true, dusk: true }, photo: '',
      },
    ],
  },
  {
    id: 'xiaoman', name: '小满', crown: 'gold', tint: 2,
    diaries: [
      {
        no: 31, date: '2026年10月25日', weather: '晴，太阳把背晒得热乎乎', mood: '饱饱的！',
        text: '我在大树最低的那根树枝上，找到了一串嫩嫩的新叶子，咬一口是甜的，像蘸了蜂蜜。我决定明天还去那根树枝。',
        happy: '吃到了好吃的树叶，还打了一个特别响的嗝。',
        worry: '吃得太饱了，转圈的时候差点跟不上豆豆。',
        scene: 'canopy', opts: {}, photo: '',
      },
      {
        no: 32, date: '2026年10月28日', weather: '小雨，叶子上全是水珠', mood: '馋',
        text: '下雨天的树皮闻起来香香的，我偷偷舔了一下，结果是苦的。原来不是所有香香的东西都好吃。',
        happy: '雨停以后，地上冒出了一小丛三叶草，我分了一半给糯米。',
        worry: '糯米说三叶草里住着一只小蜗牛，我好像差点把它吃掉了……还好它慢慢爬走了。',
        scene: 'rain', opts: {}, photo: '',
      },
    ],
  },
  {
    id: 'nuomi', name: '糯米', crown: 'gold', tint: 3,
    diaries: [
      {
        no: 5, date: '2026年10月27日', weather: '阵雨，后来出了彩虹', mood: '害羞，又有点开心',
        text: '今天栗子夸我的耳朵像两片荷叶。我想用耳朵把脸捂起来，可是耳朵太大了，捂不住。',
        happy: '雨停以后出了彩虹，我是第一个看见的。',
        worry: '我想喊“快看彩虹”，可是声音太小，只有小满听见了。',
        scene: 'rainbow', opts: {}, photo: '',
      },
      {
        no: 6, date: '2026年10月31日', weather: '多云，有一点点冷', mood: '被抱住了',
        text: '晚上冷，我缩成了一团。小满挨着我睡，她的肚子圆圆的、暖暖的，像一个小火炉。',
        happy: '今天我主动跟一只松鼠说了“你好”，它也对我点了点头。',
        worry: '半夜小满的肚子咕噜咕噜地叫，我忍不住笑出了声，又怕把她吵醒。',
        scene: 'clouds', opts: {}, photo: '',
      },
    ],
  },
  {
    id: 'lizi', name: '栗子', crown: 'gold', tint: 4,
    diaries: [
      {
        no: 22, date: '2026年10月23日', weather: '晴，最适合捡东西', mood: '发财了！',
        text: '我在树根旁边捡到了三颗圆圆的橡果、一根蓝色的羽毛，还有一块中间有洞的小石头。透过小洞看太阳，太阳变成了一颗豆子。',
        happy: '我的宝贝箱子又多了三样宝贝。',
        worry: '箱子快装不下了，可是每一样我都舍不得扔。',
        scene: 'grass', opts: { sun: true }, photo: '',
      },
      {
        no: 23, date: '2026年10月30日', weather: '起雾，什么都白白的', mood: '有点慌',
        text: '那根蓝色的羽毛不见了，我找遍了整个山坡都没找到。最后发现它粘在小石头的屁股上，他背着走了一整天都不知道。',
        happy: '羽毛找回来了。小石头说他今天戴了一天“尾巴装饰”，觉得自己特别帅。',
        worry: '找羽毛的时候不小心踩倒了一朵小花，我跟它说了对不起。',
        scene: 'mist', opts: { morning: true }, photo: '',
      },
    ],
  },
  {
    id: 'mumu', name: '木木', crown: 'gold', tint: 5,
    diaries: [
      {
        no: 12, date: '2026年10月22日', weather: '阴，空气凉凉的', mood: '安安静静',
        text: '我把耳朵贴在大树上，听见里面有“咕咚、咕咚”的声音，好像大树在喝水。我想，它一定也很渴吧。',
        happy: '我给大树浇了一鼻子的水，它的叶子轻轻晃了一下，我觉得那是在说谢谢。',
        worry: '大家都说我太安静了。其实我不是不说话，我是在听。',
        scene: 'rain', opts: { soft: true }, photo: '',
      },
      {
        no: 13, date: '2026年10月28日', weather: '晴，晚上有好多萤火虫', mood: '好奇',
        text: '一只萤火虫停在了我的鼻子尖上，一闪一闪的。我一动也不敢动，憋得眼睛都酸了。',
        happy: '它在我鼻子上停了好久好久，久到我数完了二十颗星星。',
        worry: '最后我还是打了个喷嚏，把它吹跑了。',
        scene: 'fireflies', opts: {}, photo: '',
      },
    ],
  },
  {
    id: 'xingxing', name: '星星', crown: 'gold', tint: 6,
    diaries: [
      {
        no: 40, date: '2026年10月25日', weather: '晴，夜里一朵云也没有', mood: '亮晶晶的',
        text: '大家都睡着以后，我一个人躺着看星星。我发现有几颗星星连起来很像一只小象，有长鼻子，还有圆圆的肚子。',
        happy: '我给它起了个名字，叫“大树上面的小象”。',
        worry: '我想指给大家看，可是天一亮，它就不见了。',
        scene: 'stars', opts: {}, photo: '',
      },
      {
        no: 41, date: '2026年10月31日', weather: '晴，月亮弯弯的', mood: '想做梦',
        text: '月亮弯弯的，像阿团的象牙。要是我的鼻子够得着就好了，我要把月亮挂在大树上，给大家当一盏夜灯。',
        happy: '我梦见自己在云上走路，软软的，一点也不累。',
        worry: '醒来的时候月亮已经下山了，我还没来得及跟它说再见。',
        scene: 'moon', opts: {}, photo: '',
      },
    ],
  },
  {
    id: 'xiaoshitou', name: '小石头', crown: 'gold', tint: 7, small: true,
    diaries: [
      {
        no: 3, date: '2026年10月26日', weather: '晴，影子短短的', mood: '我很了不起',
        text: '阿团说，我们走成一个圈，就没有谁是最后一只。我用鼻子拉着星星的尾巴，一整圈都没有松开。',
        happy: '我踮起脚，终于够到了大树最低的那片叶子！',
        worry: '我的王冠老是往下滑，挡住眼睛，我只好歪着头走路。',
        scene: 'clouds', opts: { bright: true }, photo: '',
      },
      {
        no: 4, date: '2026年10月29日', weather: '下午下了一场雷阵雨', mood: '先害怕，后来不怕了',
        text: '打雷的时候，我把头埋进了阿团的肚子底下。阿团说，雷声是天上的大象在跺脚，在跟我们打招呼呢。',
        happy: '我也学着跺了跺脚，“咚”！我觉得天上的大象听见了。',
        worry: '雨后的水坑太好玩了，我踩了好多下，变成了一只泥巴小象。',
        scene: 'rain', opts: { storm: true }, photo: '',
      },
    ],
  },
];
