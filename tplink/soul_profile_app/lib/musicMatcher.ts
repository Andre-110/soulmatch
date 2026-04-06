/**
 * 音乐匹配系统
 * 根据用户的 MBTI 类型，匹配对应的专属背景音乐
 */

export type MusicTrack = {
  id: string;
  name: string;
  mbtiType: string;
  url: string;
  description: string;
};

// 16 种 MBTI 类型对应的音乐库
export const MBTI_MUSIC_LIBRARY: Record<string, MusicTrack> = {
  INTJ: {
    id: 'intj',
    name: 'INTJ 专属音乐',
    mbtiType: 'INTJ',
    url: '/music/bgm/INTJ.mp3',
    description: '建筑师 - 理性思考者的深邃旋律',
  },
  INTP: {
    id: 'intp',
    name: 'INTP 专属音乐',
    mbtiType: 'INTP',
    url: '/music/bgm/INTP.mp3',
    description: '逻辑学家 - 探索未知的智慧之声',
  },
  ENTJ: {
    id: 'entj',
    name: 'ENTJ 专属音乐',
    mbtiType: 'ENTJ',
    url: '/music/bgm/ENTJ.mp3',
    description: '指挥官 - 领导者的磅礴气势',
  },
  ENTP: {
    id: 'entp',
    name: 'ENTP 专属音乐',
    mbtiType: 'ENTP',
    url: '/music/bgm/ENTP.mp3',
    description: '辩论家 - 创新思维的跃动节奏',
  },
  INFJ: {
    id: 'infj',
    name: 'INFJ 专属音乐',
    mbtiType: 'INFJ',
    url: '/music/bgm/INFJ.mp3',
    description: '提倡者 - 理想主义者的温柔共鸣',
  },
  INFP: {
    id: 'infp',
    name: 'INFP 专属音乐',
    mbtiType: 'INFP',
    url: '/music/bgm/INFP.mp3',
    description: '调停者 - 浪漫诗人的心灵之歌',
  },
  ENFJ: {
    id: 'enfj',
    name: 'ENFJ 专属音乐',
    mbtiType: 'ENFJ',
    url: '/music/bgm/ENFJ.mp3',
    description: '主人公 - 温暖治愈的和谐旋律',
  },
  ENFP: {
    id: 'enfp',
    name: 'ENFP 专属音乐',
    mbtiType: 'ENFP',
    url: '/music/bgm/ENFP.mp3',
    description: '竞选者 - 自由灵魂的欢快乐章',
  },
  ISTJ: {
    id: 'istj',
    name: 'ISTJ 专属音乐',
    mbtiType: 'ISTJ',
    url: '/music/bgm/ISTJ.mp3',
    description: '物流师 - 稳重可靠的坚实节拍',
  },
  ISFJ: {
    id: 'isfj',
    name: 'ISFJ 专属音乐',
    mbtiType: 'ISFJ',
    url: '/music/bgm/ISFJ.mp3',
    description: '守卫者 - 细腻守护的温柔乐音',
  },
  ESTJ: {
    id: 'estj',
    name: 'ESTJ 专属音乐',
    mbtiType: 'ESTJ',
    url: '/music/bgm/ESTJ.mp3',
    description: '总经理 - 高效执行的有力节奏',
  },
  ESFJ: {
    id: 'esfj',
    name: 'ESFJ 专属音乐',
    mbtiType: 'ESFJ',
    url: '/music/bgm/ESFJ.mp3',
    description: '执政官 - 热情社交的明快旋律',
  },
  ISTP: {
    id: 'istp',
    name: 'ISTP 专属音乐',
    mbtiType: 'ISTP',
    url: '/music/bgm/ISTP.mp3',
    description: '鉴赏家 - 冷静实干的沉稳音符',
  },
  ISFP: {
    id: 'isfp',
    name: 'ISFP 专属音乐',
    mbtiType: 'ISFP',
    url: '/music/bgm/ISFP.mp3',
    description: '探险家 - 艺术灵魂的自由之声',
  },
  ESTP: {
    id: 'estp',
    name: 'ESTP 专属音乐',
    mbtiType: 'ESTP',
    url: '/music/bgm/ESTP.mp3',
    description: '企业家 - 冒险精神的动感节拍',
  },
  ESFP: {
    id: 'esfp',
    name: 'ESFP 专属音乐',
    mbtiType: 'ESFP',
    url: '/music/bgm/ESFP.mp3',
    description: '表演者 - 活力四射的欢乐乐章',
  },
};

/**
 * 获取推荐音乐
 */
export function getRecommendedMusic(mbti?: string): MusicTrack {
  if (!mbti) {
    // 默认返回 INFP
    return MBTI_MUSIC_LIBRARY.INFP;
  }

  const type = mbti.toUpperCase().trim();
  const track = MBTI_MUSIC_LIBRARY[type];

  // 如果找不到对应的 MBTI 类型，返回默认
  return track || MBTI_MUSIC_LIBRARY.INFP;
}
