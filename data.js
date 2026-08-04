export const authors = {
  "keigo-higashino": {
    id: "keigo-higashino",
    name: "东野圭吾",
    summary:
      "以冷静而高可读性的叙述著称，擅长把社会议题与精巧谜面并置，让推理既具戏剧张力，也保留情感余波。",
  },
  "soji-shimada": {
    id: "soji-shimada",
    name: "岛田庄司",
    summary:
      "新本格的重要代表作者，常以宏大的不可能犯罪与浓烈叙事氛围推动故事，谜题密度和舞台感都极强。",
  },
  "seicho-matsumoto": {
    id: "seicho-matsumoto",
    name: "松本清张",
    summary:
      "社会派推理的奠基作者之一，以冷峻视角审视制度、阶层与人性，让案件背后总带着现实的寒意。",
  },
  "agatha-christie": {
    id: "agatha-christie",
    name: "阿加莎·克里斯蒂",
    summary:
      "古典推理标杆人物，节奏清晰、结构稳定，善于用精确铺陈和叙述诡计制造最后一击。",
  },
  "ellery-queen": {
    id: "ellery-queen",
    name: "埃勒里·奎因",
    summary:
      "硬核逻辑推理的重要名字，迷恋线索公平性与演绎快感，适合喜欢一步步参与破案的读者。",
  },
};

export const series = {
  "galileo-series": {
    id: "galileo-series",
    name: "伽利略系列",
    summary:
      "以汤川学为核心的系列作品，将科学解释与案件谜团组合在一起，兼具可读性、人物魅力和跨题材趣味。",
  },
  "kaga-series": {
    id: "kaga-series",
    name: "加贺探案系列",
    summary:
      "以加贺恭一郎为中心的调查线，重视人物关系与社会环境，案件解决往往伴随着情感剖面。",
  },
  "mitarai-series": {
    id: "mitarai-series",
    name: "御手洗洁系列",
    summary:
      "充满不可能犯罪、诡谲舞台与新本格美学的系列读物，适合偏爱奇观谜面的读者。",
  },
  "poirot-series": {
    id: "poirot-series",
    name: "波洛系列",
    summary:
      "古典侦探范式的代表，强调推理秩序、人物动机和结尾的戏剧性揭示。",
  },
};

export const books = [
  {
    id: "journey-under-the-midnight-sun",
    title: "白夜行",
    author: "东野圭吾",
    authorId: "keigo-higashino",
    year: 1999,
    readTime: "2026.01",
    seriesId: null,
    seriesName: "单行本",
    coverTone: "cover-slate",
    coverMark: "01",
    rating: 5,
    tags: ["社会派", "日系", "心理悬疑"],
    blurb:
      "长达数十年的命运纠缠让案件本身逐渐退到幕后，真正令人发冷的是两位主角彼此缝合的人生结构。",
    note:
      "更像一部冷色调的人物史。推理不是唯一重点，但压抑感和命运感极强，后劲很长。",
  },
  {
    id: "the-devotion-of-suspect-x",
    title: "嫌疑人X的献身",
    author: "东野圭吾",
    authorId: "keigo-higashino",
    year: 2005,
    readTime: "2026.02",
    seriesId: "galileo-series",
    seriesName: "伽利略系列",
    coverTone: "cover-ember",
    coverMark: "02",
    rating: 5,
    tags: ["社会派", "日系", "诡计流"],
    blurb:
      "以数学般克制的叙事处理牺牲、爱与自毁，把一个看似清楚的案件推向极度悲伤的终局。",
    note:
      "核心不是谜底本身，而是为了成全某人可以精密到何种程度。读完会安静很久。",
  },
  {
    id: "malice",
    title: "恶意",
    author: "东野圭吾",
    authorId: "keigo-higashino",
    year: 1996,
    readTime: "2026.03",
    seriesId: "kaga-series",
    seriesName: "加贺探案系列",
    coverTone: "cover-graphite",
    coverMark: "03",
    rating: 4,
    tags: ["日系", "心理悬疑", "叙述诡计"],
    blurb:
      "案件很早便有答案，真正的推理在于恶意为何形成、如何被伪装，以及它如何扭曲一段看似平常的关系。",
    note:
      "从动机层面完成反转，结构不炫技但非常扎实，适合喜欢心理层层剥开的读者。",
  },
  {
    id: "tokyo-zodiac-murders",
    title: "占星术杀人魔法",
    author: "岛田庄司",
    authorId: "soji-shimada",
    year: 1981,
    readTime: "2026.04",
    seriesId: "mitarai-series",
    seriesName: "御手洗洁系列",
    coverTone: "cover-violet",
    coverMark: "04",
    rating: 5,
    tags: ["本格推理", "日系", "不可能犯罪"],
    blurb:
      "带有传奇感的设定与巨大的谜面相互咬合，整本书像在邀请读者正面挑战一个足够大胆的迷宫。",
    note:
      "新本格入门常客。谜面宏大，解答也足够爽快，适合想重新点燃推理阅读兴奋感的时候。",
  },
  {
    id: "points-and-lines",
    title: "点与线",
    author: "松本清张",
    authorId: "seicho-matsumoto",
    year: 1958,
    readTime: "2026.05",
    seriesId: null,
    seriesName: "单行本",
    coverTone: "cover-forest",
    coverMark: "05",
    rating: 4,
    tags: ["社会派", "日系", "现实主义"],
    blurb:
      "以列车时刻表和细密调查推进案件，在冷静的程序感里慢慢逼出制度与人情共同构成的压力。",
    note:
      "朴素但耐读，越读越能感受到社会派的锋利来自现实细节而不是夸张诡计。",
  },
  {
    id: "murder-on-the-orient-express",
    title: "东方快车谋杀案",
    author: "阿加莎·克里斯蒂",
    authorId: "agatha-christie",
    year: 1934,
    readTime: "2026.05",
    seriesId: "poirot-series",
    seriesName: "波洛系列",
    coverTone: "cover-burgundy",
    coverMark: "06",
    rating: 5,
    tags: ["欧美", "本格推理", "经典"],
    blurb:
      "封闭环境、稳定节奏与强戏剧性收束都近乎教科书级别，是古典推理最有辨识度的样子之一。",
    note:
      "即使早知道名气，也还是会被最后的处理方式击中。结构完成度非常高。",
  },
  {
    id: "and-then-there-were-none",
    title: "无人生还",
    author: "阿加莎·克里斯蒂",
    authorId: "agatha-christie",
    year: 1939,
    readTime: "2026.06",
    seriesId: null,
    seriesName: "单行本",
    coverTone: "cover-ocean",
    coverMark: "07",
    rating: 5,
    tags: ["欧美", "本格推理", "孤岛悬疑"],
    blurb:
      "规则清晰、压迫感持续加重，角色与童谣共同构成步步逼近的倒计时，是氛围与结构同步发力的经典。",
    note:
      "节奏控制极稳，悬疑张力几乎没有浪费的段落。非常适合一口气读完。",
  },
  {
    id: "the-greek-coffin-mystery",
    title: "希腊棺材之谜",
    author: "埃勒里·奎因",
    authorId: "ellery-queen",
    year: 1932,
    readTime: "2026.07",
    seriesId: null,
    seriesName: "单行本",
    coverTone: "cover-steel",
    coverMark: "08",
    rating: 4,
    tags: ["硬核推理", "欧美", "逻辑流"],
    blurb:
      "围绕遗嘱、尸体与身份构建层层校验的逻辑游戏，细节多、回看价值高，阅读过程非常像参与一次正式推演。",
    note:
      "需要专注，但公平而过瘾。适合想要扎实演绎感、愿意慢慢咀嚼线索的读者。",
  },
];

export const allTags = [...new Set(books.flatMap((book) => book.tags))];

export function getTopic(type, id) {
  if (type === "author") {
    return authors[id] ?? null;
  }

  if (type === "series") {
    return series[id] ?? null;
  }

  return null;
}

export function getBooksForTopic(type, id) {
  if (type === "author") {
    return books.filter((book) => book.authorId === id);
  }

  if (type === "series") {
    return books.filter((book) => book.seriesId === id);
  }

  return [];
}
