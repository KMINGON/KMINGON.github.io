+++
title = "개인정보 및 방문 통계 안내"
date = '2026-09-23T09:00:00+09:00'
lastmod = '2026-10-07T09:00:00+09:00'
draft = false
summary = "Cloudflare 기본 통계와 동의 기반 Google 방문 통계의 수집 항목을 안내합니다."
+++

이 블로그는 방문 현황과 페이지 성능을 살펴보기 위해 Cloudflare Web Analytics를 기본 통계로 사용하며, 별도의 동의나 끄기 설정 없이 수집합니다. Google Analytics 4(GA4)를 이용한 추가 분석은 명시적으로 허용한 경우에만 실행합니다. Google 통계를 허용하지 않아도 모든 글을 읽을 수 있습니다.

## Cloudflare 기본 통계

Cloudflare Web Analytics는 페이지 주소, 유입 정보, 브라우저·기기·국가별 방문 현황과 페이지 로딩 시간 등의 성능 지표를 집계합니다. Cloudflare의 안내에 따르면 방문자를 추적하기 위한 쿠키나 로컬 저장소, 브라우저 지문을 사용하지 않습니다. 다만 요청을 처리하는 과정에서는 Cloudflare에 IP 주소와 브라우저 정보가 전달됩니다.

페이지 주소의 쿼리 문자열을 기록하지 않는 것은 Cloudflare가 안내하는 동작입니다. 검색어·폼 입력값을 전송하는 별도 이벤트는 추가하지 않습니다. 쿠키를 사용하지 않는다는 사실만으로 모든 지역에서 동의가 면제된다는 의미는 아닙니다.

## Google 방문 통계

허용한 경우 방문한 글의 주소와 제목, 유입 사이트의 도메인, 방문 시각, 브라우저·기기 정보와 이용 통계를 Google Analytics로 전송합니다. 방문과 세션을 구분하는 데 분석 쿠키를 사용합니다. Google은 요청을 처리하는 과정에서 IP 주소를 받습니다. IP 주소의 처리 방식은 접속 지역과 Google의 정책에 따라 달라질 수 있습니다.

페이지 주소의 쿼리 문자열과 해시, 유입 페이지의 상세 경로, 검색어, 폼 입력값은 분석 이벤트에 넣지 않습니다. 외부 링크 클릭·파일 다운로드·동영상·폼 상호작용의 자동 수집은 사용하지 않습니다. 광고 태그, Google Signals와 광고 개인 최적화도 사용하지 않습니다.

### Google 통계 허용 여부 변경

Google 통계를 명시적으로 허용한 경우에만 Google Tag Manager와 Google Analytics를 로드합니다. 미선택·거부 상태에서는 Google 분석 요청을 보내지 않습니다. 페이지 하단의 **Google 통계 설정**에서 허용하거나 거부할 수 있습니다. 선택은 이 브라우저의 로컬 저장소에 최대 180일 동안 보관합니다. 이 기록은 선택을 기억하기 위한 용도이며 다른 기기나 브라우저와 공유하지 않습니다.

허용 후 거부로 바꾸면 블로그의 Google 분석 전송을 중지하고 페이지를 새로 불러옵니다. 블로그에서 사용하는 Google 분석 쿠키도 삭제합니다. 이미 전송한 과거 데이터가 이 선택만으로 삭제되는 것은 아닙니다. 다른 서비스가 상위 도메인에서 공유하는 쿠키는 남아 있을 수 있습니다. Google 통계 동의를 거부하거나 철회해도 Cloudflare 기본 통계는 계속 수집합니다.

JavaScript를 끄거나 분석 스크립트를 차단한 환경에서는 통계 수집이 실행되지 않습니다. 브라우저가 로컬 저장소를 차단하면 다음 페이지에서 선택을 다시 요청할 수 있습니다.

## 제공 업체 및 문의

사이트는 GitHub Pages에서 제공하며, 호스팅 제공자는 서비스 제공·보안을 위해 접속 정보를 처리할 수 있습니다. 방문 통계 수집 동의는 호스팅에 필요한 요청 자체를 제어하지 않습니다.

기본 통계는 Cloudflare, 선택 동의에 따른 추가 분석은 Google에서 처리합니다. 처리 위치와 보관 방식 등은 아래 제공 업체의 안내를 참고할 수 있습니다. 블로그 운영 관련 문의는 [운영자 GitHub](https://github.com/KMINGON)를 통해 전달할 수 있습니다. 공개 문의에는 개인정보를 적지 않도록 주의해 주세요.

- [Cloudflare Web Analytics 안내](https://www.cloudflare.com/web-analytics/)
- [Cloudflare Web Analytics FAQ](https://developers.cloudflare.com/web-analytics/faq/)
- [Cloudflare 개인정보처리방침](https://www.cloudflare.com/privacypolicy/)
- [Google 개인정보처리방침](https://policies.google.com/privacy?hl=ko)
- [Google Analytics 데이터 수집 및 개인정보 보호](https://support.google.com/analytics/answer/12017362?hl=ko)
- [GitHub 개인정보처리방침](https://docs.github.com/ko/site-policy/privacy-policies/github-general-privacy-statement)
