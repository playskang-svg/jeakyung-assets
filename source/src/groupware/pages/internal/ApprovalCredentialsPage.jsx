import { useEffect, useRef, useState } from 'react';

import { approvalService } from '../../services/approvalService.js';

export default function ApprovalCredentialsPage() {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [credentials, setCredentials] = useState([]);
  const [type, setType] = useState('signature');
  const [label, setLabel] = useState('내 서명');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const load = () => approvalService.getCredentials().then(setCredentials).catch((error) => setStatus(error?.message ?? '도장·서명 정보를 불러오지 못했습니다.'));
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 4; context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = '#11172b';
  }, []);

  const point = (event) => {
    const canvas = canvasRef.current; const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0] ?? event;
    return { x: (touch.clientX - rect.left) * (canvas.width / rect.width), y: (touch.clientY - rect.top) * (canvas.height / rect.height) };
  };
  const start = (event) => { event.preventDefault(); drawingRef.current = true; const p = point(event); const context = canvasRef.current.getContext('2d'); context.beginPath(); context.moveTo(p.x, p.y); };
  const move = (event) => { if (!drawingRef.current) return; event.preventDefault(); const p = point(event); const context = canvasRef.current.getContext('2d'); context.lineTo(p.x, p.y); context.stroke(); };
  const stop = () => { drawingRef.current = false; };
  const clear = () => { const canvas = canvasRef.current; const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); setFile(null); };

  const canvasFile = () => new Promise((resolve) => canvasRef.current.toBlob((blob) => resolve(blob ? new File([blob], 'signature.png', { type: 'image/png' }) : null), 'image/png'));
  const save = async (event) => {
    event.preventDefault(); setBusy(true); setStatus('');
    try {
      const upload = type === 'signature' && !file ? await canvasFile() : file;
      if (!upload) throw new Error(type === 'stamp' ? '도장 이미지 파일을 선택해 주세요.' : '서명을 그리거나 이미지 파일을 선택해 주세요.');
      await createImageBitmap(upload);
      await approvalService.uploadCredential(upload, { type, label: label.trim(), isDefault: credentials.length === 0 });
      setFile(null); clear(); await load(); setStatus('결재용 도장·서명을 안전하게 등록했습니다.');
    } catch (error) { setStatus(error?.message ?? '도장·서명을 등록하지 못했습니다.'); }
    finally { setBusy(false); }
  };

  return <article className="gw-approval-page" aria-labelledby="approval-credential-title">
    <header className="gw-approval-heading"><div><span className="gw-eyebrow">MY APPROVAL MARK</span><h1 id="approval-credential-title">도장·서명 관리</h1><p>승인할 때 사용할 도장이나 자필 서명을 등록합니다. 승인 이력에는 사용한 이미지가 고정 기록됩니다.</p></div></header>
    <div className="gw-approval-admin-layout">
      <section className="gw-approval-card"><h2>등록된 도장·서명</h2><div className="gw-credential-list">{credentials.map((item) => <article key={item.id}><img src={item.preview_url} alt={`${item.label} 미리보기`} /><div><strong>{item.label}</strong><span>{item.credential_type === 'stamp' ? '도장' : '서명'}{item.is_default ? ' · 기본' : ''}</span></div><button type="button" onClick={async () => { if (!window.confirm('이 도장·서명을 보관 처리하시겠습니까?')) return; await approvalService.archiveCredential(item.id); await load(); }}>보관</button></article>)}</div>{credentials.length === 0 && <p className="gw-empty-state">등록된 도장이나 서명이 없습니다.</p>}</section>
      <form className="gw-approval-card gw-credential-form" onSubmit={save}><h2>새로 등록</h2><div className="gw-check-grid"><label><input type="radio" name="credential-type" checked={type === 'signature'} onChange={() => { setType('signature'); setLabel('내 서명'); }} /> 서명</label><label><input type="radio" name="credential-type" checked={type === 'stamp'} onChange={() => { setType('stamp'); setLabel('내 도장'); }} /> 도장</label></div><label className="gw-field"><span>표시 이름</span><input required maxLength="40" value={label} onChange={(event) => setLabel(event.target.value)} /></label>{type === 'signature' && <><div className="gw-signature-canvas"><canvas ref={canvasRef} width="720" height="260" onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerLeave={stop} onTouchStart={start} onTouchMove={move} onTouchEnd={stop} aria-label="서명 그리기 영역" /></div><button className="gw-secondary-button" type="button" onClick={clear}>다시 그리기</button></>}<label className="gw-field"><span>{type === 'stamp' ? '도장 이미지' : '서명 이미지로 등록(선택)'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button className="gw-primary-button" disabled={busy}>{busy ? '등록 중…' : '도장·서명 등록'}</button></form>
    </div>{status && <p className="gw-form-status" role="status">{status}</p>}
  </article>;
}
