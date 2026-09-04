import { useEffect, useState } from 'react';

import { getOnlineProfiles } from '../../services/presenceService.js';

// 프로필 카드 옆 여백에 뜨는 작은 창 — 지금 접속해 있는 사람.
//
// 접속 여부는 하트비트로 잰다(AuthContext 가 주기적으로 찍는다). 여기서는
// 같은 간격으로 명단만 다시 받아 온다. 이름을 다 늘어놓으면 자리를 넘으므로
// 몇 명만 보이고 나머지는 "+N" 으로 접어 둔다.
const REFRESH_MS = 60_000;
const VISIBLE = 4;

export default function OnlinePeek() {
  const [people, setPeople] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => getOnlineProfiles().then((rows) => { if (alive) setPeople(rows); }).catch(() => {});
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => { alive = false; window.clearInterval(timer); };
  }, []);

  if (!people || people.length === 0) return null;

  const shown = people.slice(0, VISIBLE);
  const rest = people.length - shown.length;

  return (
    <div className="gw-online-peek">
      <button
        type="button"
        className="gw-online-peek-trigger"
        aria-expanded={open}
        aria-controls="gw-online-peek-list"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="gw-online-peek-dot" aria-hidden="true" />
        <span>지금 접속 {people.length}명</span>
      </button>
      {open && (
        <ul className="gw-online-peek-list" id="gw-online-peek-list">
          {people.map((person) => (
            <li key={person.profile_id} className={person.is_me ? 'is-me' : undefined}>
              <span>{person.display_name}{person.is_me && ' (나)'}</span>
              {person.department_name && <small>{person.department_name}</small>}
            </li>
          ))}
        </ul>
      )}
      {!open && rest > 0 && <span className="gw-online-peek-more">{shown.map((p) => p.display_name).join(', ')} 외 {rest}명</span>}
    </div>
  );
}
