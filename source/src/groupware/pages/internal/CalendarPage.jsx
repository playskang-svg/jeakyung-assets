import PageScaffold from '../../components/PageScaffold.jsx';
import { PAGE_MODULES, toSections } from '../../config/pageModules.js';

export default function CalendarPage() {
  return <PageScaffold eyebrow="CALENDAR" title="일정" description="개인·부서·전사 일정을 권한과 공개 범위에 따라 확인합니다." sections={toSections(PAGE_MODULES.calendar)} />;
}
