import EmbeddedSite from '../../components/EmbeddedSite.jsx';

// 사내 공용 자료를 두는 구글 드라이브 폴더.
//
// 폴더 주소를 그대로 액자에 넣으면 구글이 막는다(X-Frame-Options). 대신
// 구글이 끼워 넣기용으로 따로 내주는 embeddedfolderview 를 쓴다. 파일이
// 바둑판으로 늘어서고 눌러서 열 수 있다.
//
// 이 화면이 비어 보이거나 로그인을 요구하면 폴더 공유 설정 문제다. 드라이브에서
// "링크가 있는 모든 사용자"로 열어 두어야 사내 누구나 볼 수 있다.
const FOLDER_ID = '1fO-RtkoocBUQQ4zb6q0KoX4dgREGcQbZ';
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}`;
const EMBED_URL = `https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#grid`;

export default function FilesPage() {
  return (
    <article className="gw-page gw-external-view" aria-labelledby="files-title">
      <header className="gw-external-view-head">
        <h1 id="files-title">파일</h1>
        <a href={FOLDER_URL} target="_blank" rel="noopener noreferrer">드라이브에서 열기 ↗</a>
      </header>
      <EmbeddedSite url={EMBED_URL} title="사내 공용 자료 폴더" />
    </article>
  );
}
