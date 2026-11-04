// 第四页：潜伏手账里的人物说明和照片。改文字直接改这里。
// actor 留空的人物，大图旁边就不显示“某某 饰”。

export const PEOPLE = {
  yuzecheng: {
    name: '余则成', actor: '孙红雷',
    facts: [['身份', '军统天津站（后为保密局），后升任副站长'], ['代号', '峨眉峰']],
    bio: '原是重庆军统的外勤。上级吕宗方和恋人左蓝让他看清了国民党的腐败，他秘密加入共产党，又被派回军统潜伏，到天津站给当年的老师吴敬中做帮手。他和翠平扮成夫妻，在陆桥山、李涯的明争暗斗之间站稳脚跟，先后扳倒马奎和陆桥山。解放前夕，他被站长带去台湾，在那边继续潜伏。',
  },
  cuiping: {
    name: '翠平', actor: '姚晨',
    facts: [['身份', '太行山区的游击队长'], ['任务', '和余则成扮成夫妻']],
    bio: '组织临时把她派到天津，好坐实余则成“已婚”的档案。她性子直、口无遮拦，不懂城里官太太的规矩，起初让余则成整天提心吊胆。左蓝牺牲后，她懂得了地下斗争的分量，两人越配合越默契，假夫妻也有了真感情。最后在去机场的路上，余则成认出了她，把名单交到她手里，两人从此分别。',
  },
  zuolan: {
    name: '左蓝', actor: '沈傲君',
    facts: [['身份', '中共地下党员'], ['和余则成', '恋人']],
    bio: '在重庆时，她是让余则成走上这条路的人之一。抗战胜利后，她作为共方代表到天津参加军事调处，在会场上和余则成重逢，两人暗中配合，对付马奎和陆桥山。后来马奎找上门，她和翠平合力击毙马奎；为了掩护翠平，她瞒着自己的伤势，最终牺牲。此后余则成常常一遍遍读她留下的日记。',
  },
  wanqiu: {
    name: '晚秋', actor: '',
    facts: [['身份', '穆连成的侄女，新派女学生']],
    bio: '她倾慕余则成。吴敬中想借她和穆家的关系敛财，曾安排余则成和她“谈情说爱”。后来她嫁了人，心里却一直放不下余则成，翠平为此吃了不少醋。',
  },
  wujingzhong: {
    name: '吴敬中', actor: '冯恩鹤',
    facts: [['身份', '军统天津站站长'], ['和余则成', '青浦特训班时的老师']],
    bio: '圆滑老练，借职务四处敛财，把余则成当成心腹。他早年把特务“佛龛”安插进延安。解放前夕，他忙着把家产转到台湾，也把余则成一起带了过去。',
  },
  liya: {
    name: '李涯', actor: '祖峰',
    facts: [['代号', '佛龛'], ['身份', '军统特务，后回到天津站']],
    bio: '早年被吴敬中安插进延安。余则成提供线索后，他在延安被捕，又被共方拿去交换秋掌柜，回到了天津站。他认死理、处处怀疑余则成，是余则成最难缠的对手。',
  },
  daili: {
    name: '戴笠', actor: '',
    facts: [['字', '雨农'], ['身份', '军统局局长，手下人称“老板”']],
    bio: '历史上真有其人。1946 年 3 月，他乘坐的飞机在南京附近的岱山失事。剧里，天津站正是在这时得到“戴局长的飞机失踪了”的消息。',
  },
};

// 手账里可以点开的图片，按翻页的顺序排。
// 左页三张剧照的人物是按这一页剪贴的文字配的，如果照片里是别人，把 people 改掉即可。
// locked: true 的图片（指纹）要等人物关系全部点开以后，才出现在大图里。
export const PHOTOS = [
  {
    id: 'group', src: 'assets/qianfu/group.jpg', w: 1800, h: 1052,
    title: '《潜伏》剧组全家福',
    caption: '贴在扉页上的签名合照。照片上下两排红色的字，是剧组成员的亲笔签名。',
    people: [],
  },
  {
    id: 'still-1', src: 'assets/qianfu/still-1.jpg', w: 556, h: 561,
    title: '左页的第一张剧照',
    caption: '贴在左页右上角，上面压着一枚蓝色圆点贴纸。这一页的剪贴写的是余则成和翠平。',
    people: ['yuzecheng', 'cuiping'],
  },
  {
    id: 'still-2', src: 'assets/qianfu/still-2.jpg', w: 619, h: 384,
    title: '左页的第二张剧照',
    caption: '和格子纸、旧报纸剪下的玫瑰贴在一起。',
    people: ['yuzecheng', 'cuiping'],
  },
  {
    id: 'still-3', src: 'assets/qianfu/still-3.jpg', w: 663, h: 390,
    title: '左页的第三张剧照',
    caption: '压在第二张下面，再往下就是这一页最后两行字。',
    people: ['yuzecheng', 'cuiping'],
  },
  {
    id: 'lyrics', src: 'assets/qianfu/page-right.jpg', w: 900, h: 1240,
    title: '右页：《深海》',
    caption: '一句一句剪下来贴好的歌词。词里提到的人，都在下面。',
    people: ['wanqiu', 'daili', 'liya', 'zuolan', 'wujingzhong'],
  },
  {
    id: 'zuolan', src: 'assets/qianfu/zuolan.jpg', w: 1080, h: 2295,
    title: '左蓝',
    caption: '蓝色的海水做底，两张剧照，一句问话。',
    people: ['zuolan'],
  },
  {
    id: 'zuolan-photo', src: 'assets/qianfu/zuolan-photo.jpg', w: 1440, h: 960,
    title: '左蓝的旧照',
    caption: '一张泛黄的单人照：穿着军装的左蓝站在廊柱旁，笑着看过来。',
    people: ['zuolan'],
  },
  {
    id: 'note', src: 'assets/qianfu/note-wanqiu.jpg', w: 1196, h: 1576,
    title: '贴在左蓝旁边的旧照片',
    // 人物是按手写的那段话配的（话里提到了晚秋）；如果照片里是别人，改 people 即可。
    caption: '黑白的旧照片上压着一张半透明的纸，手写了一段话，话里提到了晚秋。',
    people: ['wanqiu', 'yuzecheng'],
  },
  {
    id: 'print', src: 'assets/qianfu/fingerprint.jpg', w: 1170, h: 1560, locked: true,
    title: '一枚由台词拼成的指纹',
    caption: '人物关系页上的那枚指纹。每一道纹路都是剧里的一句台词，有红有黑，绕着中心一圈圈排开。',
    people: [],
  },
];

// 人物关系页上的指纹：每点开一个人的说明，就显出朝向那个人的一块；点中间的人，显出指纹中心。
// ink 是去掉白底、能印在牛皮纸上的版本；core 是指纹中心在图里的位置（比例）；width 是指纹占页面宽度的百分比。
export const PRINT = { ink: 'assets/qianfu/fingerprint-ink.png', w: 893, h: 1331, core: [0.52, 0.5], width: 74, coreRadius: 0.2 };

// 人物关系页：名字的位置（占页面的百分比）和连线上写的字。
export const CHART = {
  center: { id: 'yuzecheng', x: 50, y: 50 },
  links: [
    { id: 'zuolan', x: 25, y: 25, label: '恋人' },
    { id: 'cuiping', x: 24, y: 76, label: '假夫妻，真感情' },
    { id: 'wujingzhong', x: 76, y: 24, label: '老师，站长' },
    { id: 'liya', x: 80, y: 57, label: '死对头' },
    { id: 'wanqiu', x: 74, y: 80, label: '倾慕' },
  ],
};
