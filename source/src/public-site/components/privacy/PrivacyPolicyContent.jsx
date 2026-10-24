export default function PrivacyPolicyContent() {
  return (
    <>
      <section className="policy-hero">
        <div className="content-width">
          <span className="eyebrow eyebrow-light"><i /> Privacy Policy</span>
          <h1>개인정보처리방침</h1>
          <p>유한회사 재경로지스는 개인정보 보호를 중요하게 생각하며, 현재 재경로지스｜물류 웹사이트의 운영 방식과 문의 경로를 투명하게 안내합니다.</p>
        </div>
      </section>

      <section className="policy-content">
        <div className="content-width policy-layout">
          <article className="policy-article">
            <p className="policy-summary"><strong>챗봇상담창에서 입력하여 전송한 질문과 대화 맥락은 답변 생성을 위해 Anthropic의 Claude API로 전송됩니다.</strong> 웹사이트는 대화 원문을 별도 데이터베이스에 저장하거나 담당자에게 자동 전달하지 않습니다. 개별 견적·계약 상담은 카카오톡 채널을 이용해 주세요.</p>

            <section className="policy-section">
              <h2>1. 개인정보의 처리 목적 및 항목</h2>
              <p>챗봇상담 답변을 생성하기 위해 이용자가 입력한 질문과 같은 대화창의 앞선 메시지를 처리합니다. 연락처, 주민등록번호, 결제 정보 등 개인정보나 민감정보를 입력하지 마세요. 별도의 문의 양식이나 결제 기능은 운영하지 않습니다.</p>
            </section>

            <section className="policy-section">
              <h2>2. 보유 및 이용 기간</h2>
              <p>상담 대화는 현재 브라우저 화면에서만 유지되며 새로고침하면 사라집니다. 재경로지스는 대화 원문을 별도 데이터베이스에 저장하지 않습니다. Claude API에 전송한 입력과 출력에는 Anthropic의 상업용 API 데이터 처리 기준이 적용됩니다. <a href="https://privacy.anthropic.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data" target="_blank" rel="noopener noreferrer">Anthropic의 보유 기간 안내</a>를 확인해 주세요. 카카오톡 등 외부 채널에는 해당 서비스의 정책이 적용됩니다.</p>
            </section>

            <section className="policy-section">
              <h2>3. 제3자 제공 및 처리 위탁</h2>
              <p>챗봇상담에서 메시지를 보내면 답변 생성을 위해 메시지와 대화 맥락을 Anthropic의 Claude API로 전송합니다. 카카오톡 상담 또는 Google 지도 링크를 선택하면 외부 서비스로 이동하며 해당 서비스의 정책이 적용됩니다.</p>
              <ul>
                <li>Anthropic Claude API: AI 챗봇 답변 생성</li>
                <li>카카오톡 채널: 서비스 상담 연결</li>
                <li>Google 지도: 본사 위치 확인</li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>4. 쿠키 및 자동 수집 정보</h2>
              <p>현재 재경로지스｜물류는 맞춤형 광고나 방문자 분석을 위한 자체 쿠키를 사용하지 않습니다. 다만 호스팅·통신 과정에서 서비스 안정성과 보안을 위한 접속 기록 등이 관련 사업자의 시스템에 생성될 수 있으며, 이에 대해서는 해당 사업자의 정책이 적용됩니다.</p>
            </section>

            <section className="policy-section">
              <h2>5. 정보주체의 권리</h2>
              <p>이용자는 개인정보 처리 여부의 확인, 열람, 정정·삭제, 처리정지 등 관계 법령에서 정한 권리를 행사할 수 있습니다. 상담 대화 원문은 웹사이트 데이터베이스에 보관하지 않습니다. 관련 문의가 있는 경우 아래 담당 부서로 연락해 주시면 확인 후 안내하겠습니다.</p>
            </section>

            <section className="policy-section">
              <h2>6. 개인정보의 안전성 확보 조치</h2>
              <p>AI API 키는 브라우저에 공개하지 않고 서버의 비밀값으로 관리합니다. 상담 메시지는 암호화된 통신으로 전송하며, 입력 길이와 요청 횟수를 제한합니다.</p>
            </section>

            <section className="policy-section" id="privacy-contact">
              <h2>7. 개인정보 보호 문의</h2>
              <p>개인정보 보호와 관련한 문의 또는 권리 행사는 다음 담당 부서로 연락해 주세요.</p>
              <ul>
                <li>담당 부서: 경영지원부</li>
                <li>전화: <a href="tel:0708008100">070-800-8100</a></li>
                <li>이메일: <a href="mailto:sk@jeakyung.com">sk@jeakyung.com</a></li>
              </ul>
            </section>

            <section className="policy-section">
              <h2>8. 개정 고지</h2>
              <p>본 방침은 2026년 10월 24일부터 적용됩니다. 내용이 변경되는 경우 웹사이트를 통해 공지합니다.</p>
            </section>
          </article>
        </div>
      </section>
    </>
  );
}
