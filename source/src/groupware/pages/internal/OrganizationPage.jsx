import PageScaffold from '../../components/PageScaffold.jsx';
import { PAGE_MODULES, toSections } from '../../config/pageModules.js';

export default function OrganizationPage() {
  return <PageScaffold eyebrow="ORGANIZATION" title="조직도" description="부서 구조와 구성원을 권한 범위 안에서 탐색하는 화면입니다." sections={toSections(PAGE_MODULES.organization)} />;
}
