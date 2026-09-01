export const WORK_SYSTEM_URL = 'https://jeakyung.com/groupware/';
export const CONSULTATION_URL = 'https://pf.kakao.com/_xgrFxhn/chat';

export const navigationByPage = {
  home: [
    { href: '#about', label: '재경닷컴 소개' },
    { href: 'news/', label: '소식/정보' },
    { href: '#services', label: '서비스' },
    { href: '#audience', label: '고객별 안내' },
    { href: '#guide', label: '상담 준비' },
    { href: '#location', label: '찾아오시는 길' },
    { href: '#faq', label: 'FAQ' },
  ],
  privacy: [
    { href: '../#about', label: '재경닷컴 소개' },
    { href: '../news/', label: '소식/정보' },
    { href: '../#services', label: '서비스' },
    { href: '../#location', label: '찾아오시는 길' },
    { href: '../#faq', label: 'FAQ' },
  ],
  news: [
    { href: '../#about', label: '재경닷컴 소개' },
    { href: './', label: '소식/정보' },
    { href: '../#services', label: '서비스' },
    { href: '../#location', label: '찾아오시는 길' },
    { href: '../#faq', label: 'FAQ' },
  ],
};

export const footerLinksByPage = {
  home: {
    home: '#top',
    about: '#about',
    services: '#services',
    location: '#location',
    guide: '#guide',
    faq: '#faq',
    privacy: 'privacy/',
  },
  privacy: {
    home: '../',
    about: '../#about',
    services: '../#services',
    location: '../#location',
    guide: '../#guide',
    faq: '../#faq',
    privacy: './',
  },
  news: {
    home: '../',
    about: '../#about',
    services: '../#services',
    location: '../#location',
    guide: '../#guide',
    faq: '../#faq',
    privacy: '../privacy/',
  },
};
