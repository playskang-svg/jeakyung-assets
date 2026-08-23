import PageScaffold from '../../components/PageScaffold.jsx';
import { PAGE_MODULES, toSections } from '../../config/pageModules.js';

export default function ApprovalPage() {
  return <PageScaffold eyebrow="APPROVAL" title="전자결재" description="기안부터 결재 완료까지 문서 흐름과 처리 상태를 관리합니다." sections={toSections(PAGE_MODULES.approval)} />;
}
