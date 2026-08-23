import PageScaffold from '../../components/PageScaffold.jsx';
import { PAGE_MODULES, toSections } from '../../config/pageModules.js';

export default function FilesPage() {
  return <PageScaffold eyebrow="FILES" title="파일" description="개인·부서·공용 업무 파일을 안전한 권한 정책으로 관리합니다." sections={toSections(PAGE_MODULES.files)} />;
}
