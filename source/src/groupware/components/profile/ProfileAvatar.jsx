import { useEffect, useState } from 'react';

import { getProfilePhotoUrl } from '../../services/profileService.js';

export default function ProfileAvatar({ profile, size = 'medium' }) {
  const [source, setSource] = useState('');
  const name = profile?.display_name || profile?.preferred_name || profile?.full_name || profile?.name || '사용자';

  useEffect(() => {
    let active = true;
    setSource('');
    if (!profile?.profile_photo_path) return undefined;
    getProfilePhotoUrl(profile.profile_photo_path)
      .then((url) => { if (active) setSource(url || ''); })
      .catch(() => {});
    return () => { active = false; };
  }, [profile?.profile_photo_path]);

  return (
    <span className={`gw-profile-avatar gw-profile-avatar--${size}`} aria-label={`${name} 프로필 사진`}>
      {source ? <img src={source} alt="" /> : <span aria-hidden="true">{name.slice(0, 1)}</span>}
    </span>
  );
}
