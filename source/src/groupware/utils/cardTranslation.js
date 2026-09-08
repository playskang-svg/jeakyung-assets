// Hangul romanization & Business Card English translation helper

const SURNAMES = {
  '강': 'Kang', '김': 'Kim', '이': 'Lee', '박': 'Park', '최': 'Choi',
  '정': 'Jung', '조': 'Cho', '윤': 'Yoon', '장': 'Jang', '임': 'Lim',
  '한': 'Han', '오': 'Oh', '서': 'Seo', '신': 'Shin', '권': 'Kwon',
  '황': 'Hwang', '안': 'Ahn', '송': 'Song', '전': 'Jeon', '홍': 'Hong',
  '유': 'Yoo', '고': 'Ko', '문': 'Moon', '양': 'Yang', '손': 'Sohn',
  '배': 'Bae', '백': 'Baek', '허': 'Heo', '노': 'Noh', '남': 'Nam',
  '심': 'Shim', '하': 'Ha', '곽': 'Kwak', '성': 'Seong', '차': 'Cha',
  '주': 'Joo', '우': 'Woo', '구': 'Koo', '민': 'Min', '진': 'Jin',
  '지': 'Ji', '엄': 'Eom', '채': 'Chae', '원': 'Won', '천': 'Cheon',
  '방': 'Bang', '공': 'Kong', '현': 'Hyun', '함': 'Ham', '변': 'Byun',
  '염': 'Yeom', '여': 'Yeo', '추': 'Chu',
};

const INITIALS = ['G','Kk','N','D','Tt','R','M','B','Pp','S','Ss','','J','Jj','Ch','K','T','P','H'];
const MEDIALS = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
const FINALS = ['','k','k','k','n','n','n','t','l','k','m','p','t','t','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

const CUSTOM_SYLLABLES = {
  '석': 'Seok', '기': 'ki', '길': 'Gil', '동': 'dong', '달': 'Dal', '성': 'seong',
  '순': 'Soon', '신': 'shin', '철': 'Cheol', '수': 'soo', '영': 'Young', '희': 'hee',
  '민': 'Min', '훈': 'Hoon', '현': 'Hyun', '진': 'Jin', '재': 'Jae', '경': 'Kyung',
  '혁': 'Hyeok', '준': 'Jun', '호': 'Ho', '우': 'Woo', '원': 'Won', '정': 'Jung',
  '태': 'Tae', '환': 'Hwan', '광': 'Kwang', '선': 'Sun', '용': 'Yong',
};

function romanizeSyllable(char) {
  if (CUSTOM_SYLLABLES[char]) return CUSTOM_SYLLABLES[char];
  const code = char.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return char;
  const i = Math.floor(code / 588);
  const m = Math.floor((code % 588) / 28);
  const f = code % 28;
  return INITIALS[i] + MEDIALS[m] + FINALS[f];
}

export function romanizeKoreanName(fullName) {
  fullName = (fullName || '').trim();
  if (!fullName) return '';
  const surname = SURNAMES[fullName[0]] || romanizeSyllable(fullName[0]);
  const given = fullName.slice(1);
  if (!given) return surname;
  const parts = [...given].map((c, idx) => {
    let r = romanizeSyllable(c);
    return idx === 0 ? r.charAt(0).toUpperCase() + r.slice(1).toLowerCase() : r.toLowerCase();
  });
  return `${parts.join('-')} ${surname}`;
}

export const DEPT_TRANSLATIONS = {
  '시스템운영부': 'System Operations Dept.',
  '시스템운영': 'System Operations',
  '물류운영부': 'Logistics Operations Dept.',
  '물류운영': 'Logistics Operations',
  '물류영업부': 'Logistics Sales Dept.',
  '영업부': 'Sales Dept.',
  '영업': 'Sales',
  '경영지원부': 'Management Support Dept.',
  '경영지원': 'Management Support',
  '재경부': 'Finance & Accounting Dept.',
  '재경팀': 'Finance Team',
  '재경': 'Finance',
  '지입관리부': 'Fleet & Consignment Dept.',
  '지입관리': 'Consignment Management',
  '지입관리업무': 'Fleet Management',
  '운송관리부': 'Transportation Management Dept.',
  '운송관리': 'Transportation Management',
  '인사총무부': 'HR & General Affairs Dept.',
  '인사총무': 'HR & General Affairs',
  '고객지원팀': 'Customer Support Team',
  '기획조정실': 'Planning & Strategy Office',
};

export const TITLE_TRANSLATIONS = {
  '대표이사': 'CEO & President',
  '대표': 'CEO',
  '부사장': 'Vice President',
  '전무': 'Senior Managing Director',
  '상무': 'Managing Director',
  '이사': 'Director',
  '본부장': 'Head of Division',
  '부장': 'General Manager',
  '차장': 'Deputy General Manager',
  '과장': 'Manager',
  '대리': 'Assistant Manager',
  '주임': 'Senior Associate',
  '사원': 'Associate',
  '팀장': 'Team Leader',
  '지사장': 'Branch Manager',
  '소장': 'Site Manager',
};

export function translateDepartment(dept) {
  if (!dept) return '';
  const trimmed = dept.trim();
  return DEPT_TRANSLATIONS[trimmed] || (trimmed.endsWith('부') ? `${trimmed.slice(0, -1)} Dept.` : trimmed);
}

export function translateTitle(title) {
  if (!title) return '';
  return TITLE_TRANSLATIONS[title.trim()] || title.trim();
}

export function translateAddress(addr) {
  if (!addr) return '';
  let en = addr;
  let suite = '';
  const suiteMatch = en.match(/(\d+)호/);
  if (suiteMatch) {
    suite = `Suite ${suiteMatch[1]}, `;
    en = en.replace(/(\d+)호/, '');
  }
  let branch = '';
  if (en.includes('서울경지지사')) {
    branch = ' (Seoul-Gyeonggi Branch)';
    en = en.replace(/서울경지지사/, '');
  } else if (en.includes('본사')) {
    branch = ' (HQ)';
    en = en.replace(/본사/, '');
  }
  en = en.replace(/경기도/g, 'Gyeonggi-do');
  en = en.replace(/서울특별시|서울시/g, 'Seoul');
  en = en.replace(/인천광역시|인천시/g, 'Incheon');
  en = en.replace(/평택시/g, 'Pyeongtaek-si');
  en = en.replace(/비전2로/g, 'Bijeon 2-ro');
  en = en.replace(/비전동/g, 'Bijeon-dong');
  en = en.replace(/\(([^\)]+)\)/g, '');
  en = en.replace(/\s+/g, ' ').trim();

  return `${suite}${en}, Republic of Korea${branch}`;
}
