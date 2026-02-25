+++
date = '2026-02-23T21:35:00+09:00'
draft = false
title = '[Review] OAuth/OIDC Misconfiguration 취약점 분석'
summary = "OAuth/OIDC 프로토콜의 Implicit Grant Type과 Authorization Grant Type에서 발생할 수 있는 취약점 리뷰"
toc = true
tags = ["OAuth", "OIDC", "AccessToken", "state", "PKCE", "Authentication", "Authorization"]
+++

---


## 들어가며

우리는 일상적으로 Google, Microsoft, Kakao 등의 소셜 계정을 통해 다양한 Third-party 서비스에 로그인하고 인증한다. 이러한 간편한 인증/인가를 가능하게 해주는 핵심 기반 기술이 바로 OAuth 2.0 및 OIDC 프로토콜이다.

이번 글에서는 이러한 OAuth/OIDC의 기본 프로토콜 흐름과 개념을 이해하고, 해당 프로토콜을 사용하여 소셜 로그인 기능을 구현할 때 개발자의 실수로 인해 발생할 수 있는 취약점 두 가지를 중점적으로 분석한다.

Open Redirect 등 프로토콜 자체의 취약점은 OAuth/OIDC 프로토콜을 제공하는 Google과 같은 대형 Provider에서 조기에 발견하고 패치한다.  
따라서 본 글에서는 프로토콜 구현 자체는 정상적이나, 서비스 개발자가 이를 본인의 서비스에 연동할 때 실수할 가능성이 높고 실제 버그바운티 프로그램에서 빈번하게 발견되는 구현상의 취약점을 다룬다.

취약점 분석에 앞서, 이를 이해하기 위한 필수 배경지식인 OAuth 2.0의 아키텍처와 동작 원리를 먼저 살펴본다.

---

## OAuth/OIDC 개념

기존의 중앙집중식 인증 모델에서는 사용자가 제3자 애플리케이션에 자신의 계정 정보(ID/Password)를 직접 제공해야 했다.  
OAuth는 이러한 문제를 해결하기 위해 인증 계층을 분리하여, 사용자의 비밀번호를 노출하지 않고도 서비스 간에 안전한 접근 권한 위임을 가능하게 한다.

OAuth 2.0 아키텍처는 다음 4가지 핵심 Role로 구성된다.
- Resource Owner (사용자): 보호되는 자원에 대한 접근 권한을 부여할 수 있는 개체, 즉 사용자이다.
- Client (클라이언트): 사용자를 대신하여 보호된 자원에 접근을 요청하는 제3자 애플리케이션이다 (예: 사용자가 이용하려는 특정 서비스).
- Authorization Server (인가 서버): 사용자를 성공적으로 인증한 후 클라이언트에게 권한의 증표인 토큰을 발급하는 서버이다 (예: Google, Facebook의 인증 서버).
- Resource Server (자원 서버): 사용자의 보호된 자원(데이터)을 호스팅하며, 토큰을 검증하여 요청을 수락하는 서버이다.

OIDC는 이 OAuth 2.0 프레임워크 위에 구축된 인증 레이어로, 단순히 무엇을 할 수 있는지를 나타내는 Access Token뿐만 아니라, 누가 인증되었는지를 증명하는 신분증 역할인 ID Token을 추가로 발급하여 소셜 로그인을 완성한다.

---

## OAuth/OIDC의 동작 원리 (Grant Type)

OAuth 2.0은 클라이언트의 환경에 따라 권한을 위임받는 다양한 Grant Type을 제공한다.  
[Spring Security: Part2. OAuth 2.0 아키텍처 이해와 보안 취약점 사례](https://www.igloo.co.kr/security-information/spring-security-part2-oauth-2-0-%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98-%EC%9D%B4%ED%95%B4%EC%99%80-%EB%B3%B4%EC%95%88-%EC%B7%A8%EC%95%BD%EC%A0%90-%EC%82%AC%EB%A1%80/) 글을 참고하면 전체 Grant Type에 대한 설명이 잘 되어있으며, 본 글에서는 이후 다룰 취약점들의 동작 원리를 명확히 이해하기 위한 두 가지 흐름을 설명한다.

### Authorization Code Grant Type

백엔드 서버가 존재하는 클라이언트에서 주로 사용되는 방식이다.
![스크린샷 2026-01-13 134435.png](/review/2/image0.png)
먼저 클라이언트가 사용자를 인가 서버의 로그인 페이지로 리다이렉트 시킨다. 이때 `redirect_uri`와 CSRF 방지를 위한 `state` 파라미터를 함께 전달한다.

이후 사용자가 로그인을 완료하면, 인가 서버는 클라이언트의 `redirect_uri`로 Authorization Code를 전달한다.

마지막으로 클라이언트는 전달받은 코드를 브라우저에 노출하지 않고, 백엔드 서버 간 통신을 통해 인가 서버의 Token Endpoint로 전송하여 Access Token(또는 ID Token)과 교환한다.

이 방식은 민감한 토큰이 사용자 브라우저에 직접 노출되지 않기 때문에 PKCE 등장 이전의 표준 방식으로 간주되며, 현재도 자주 쓰이는 방식이다.

### Implicit Grant Type

SPA와 같이 백엔드 서버 없이 프론트엔드만 존재하는 공개 클라이언트에 최적화된 방식이다.
![스크린샷 2026-01-13 134435.png](/review/2/image.png)
먼저 앞선 방식과 동일하게 사용자를 인가 서버로 리다이렉트 시킨다.

이후 Authorization Code를 발급하고 이를 다시 교환하는 2단계 과정을 생략하고, 인가 서버가 `redirect_uri`의 URL Fragment에 Access Token을 직접 포함하여 브라우저로 전달한다.

이 방식은 구현이 단순하고 서버 간 통신이 필요 없다는 장점이 있으나, URL을 통해 토큰이 브라우저에 직접 노출되므로 탈취 및 재사용 공격에 매우 취약하다는 단점이 있다.  
하지만 OAuth 프로토콜을 사용하는 버그바운티 프로그램을 분석해보면 아직 Implicit Grant Type을 사용하는 서비스를 심심치 않게 찾아볼 수 있다.

---

## AccessToken Audience Claim 검증 미흡 취약점

앞서 설명한 Implicit Grant Type 에서는 인가 서버가 프론트엔드로 AccessToken을 직접 전달한다.

클라이언트는 전달받은 토큰을 이용해 인가 서버의 API를 호출하고, 사용자의 식별 정보(보통 Email Claim을 사용한다.)를 받아와 로그인을 처리한다.

이때 개발자가 흔히 저지르는 실수는 `aud` claim 즉, "이 토큰이 정말로 우리 서비스를 위해 발급된 토큰인가?"를 검증하지 않는 것이다.
![alt text](/review/2/image2.png)

### 취약점 개요

소셜 로그인(본 설명에서는 편의상 Google Provider를 기준으로 설명한다.) 시, 인가 서버는 해당 토큰을 요청한 주체가 누구인지 식별하기 위해 `Audience`를 토큰에 함께 부여한다. 즉, A라는 서비스가 요청한 토큰은 A 서비스의 `Audience`를 가지고 있으며, B라는 서비스가 요청한 토큰은 B 서비스의 `Audience`를 가진다.  
[Google for Developers - Verify the Google ID token on your server side | Web guides](https://docs.cloud.google.com/docs/authentication/token-types?hl=ko#access-tokens) 문서의 `IdToken` 에 대한 설명을 보면 aud claims 검증 진행이 명시되어있다.   
(Access Token의 Claims에 대한 공식 문서는 찾지 못했으며, 개발자 실수의 원인 중 하나인 것으로 추측된다.)

만약 서비스 백엔드에서 전달받은 Access Token으로 사용자 프로필만 조회하고 해당 토큰의 Audience를 검증하지 않는다면, 공격자는 다른 서비스(자신이 만든 악성 앱)에서 발급받은 피해자의 정상적인 토큰을 타겟 서비스에 주입하여 피해자의 계정을 탈취할 수 있다.

Salt Labs의 [Oh-Auth — Abusing OAuth to take over millions of accounts](https://salt.security/blog/oh-auth-abusing-oauth-to-take-over-millions-of-accounts) 글에서는 월간 활성 사용자 1억 명 을 보유한 Vidio, 1억 5천만 사용자를 보유한 Bukalapak, 일일 사용자 3천만명을 보유한 Grammarly 등 대형 서비스에서도 2023년에 동일한 취약점이 발견되었다고 설명한다.

실제로 2025년 하반기에 진행한 버그바운티에서도 3개 서비스에서 동일한 취약점을 발견해 제보했다.

당시 프로젝트에서 확인한 취약점과 일부 시나리오는 [OWASP Seoul Chapter 2025년 7월 세미나 - 주제#1 : 해커들이 좋아하는 인증 환경은 따로 있다?](https://owasp.org/www-chapter-seoul/#div-pastevents) 세미나 발표에서 다룬 바 있다.  
다만 해당 발표는 취약점 자체보다 자동화 진단 도구에 초점을 두었으므로, 본 글에서는 Salt Labs 사례를 바탕으로 이 취약점이 계정 탈취로 이어지는 과정을 구체적인 공격 시나리오 중심으로 분석한다.

### 공격 시나리오 분석

Salt Labs가 다룬 타겟 서비스들은 주로 Facebook 로그인을 사용하였으므로, 아래 시나리오는 Facebook OAuth Provider를 기준으로 설명한다.

1. 악성 애플리케이션 생성 및 토큰 수집

공격자는 피해자의 Access Token을 탈취하기 위해 매력적으로 보이는 가짜 웹사이트나 앱(`YourTimePlanner.com`이라 가정)을 생성한다.  
피해자가 이 악성 사이트에 방문하여 "Facebook으로 로그인"을 클릭하면, 공격자는 자신의 App ID로 발급된 피해자의 정상적인 Access Token을 획득하게 된다.

2. 타겟 서비스에 악성 토큰 주입

공격자는 타겟 서비스(예: `TargetSite.com`)의 소셜 로그인 엔드포인트에 접근한다.  
타겟 서비스는 일반적으로 프론트엔드에서 발급받은 토큰을 백엔드로 전달하여 인증을 처리하는 API(예: `/api/facebook/auth`)를 가지고 있다.  
공격자는 자신의 토큰 대신, 1번 단계에서 획득한 피해자의 Access Token을 이 API에 주입한다.

3.  타겟 서비스의 잘못된 인증 처리

타겟 서비스의 백엔드는 공격자가 주입한 Access Token을 사용하여 Facebook의 Graph API(예: `/me?fields=email`)를 호출한다.  
이 Access Token은 Facebook이 정상적으로 발급한 토큰이 맞으므로, Facebook은 피해자의 이메일 정보(예: `victim@gmail.com`)를 타겟 서비스에 반환한다.

4. 계정 탈취 성공

타겟 서비스는 반환된 이메일이 `victim@gmail.com`인 것을 확인하고, 토큰이 타겟 서비스를 위해 발급된 것인지(App ID 검증) 확인하지 않은 채 그대로 피해자의 계정으로 로그인 세션을 생성해 버린다.  
결과적으로 공격자는 타겟 서비스에 있는 피해자의 계정에 완전한 접근 권한을 얻게 된다.

### 실제 사례와의 비교

실제 Salt Labs의 보고서에 등장하는 Vidio와 Bukalapak이 바로 이 시나리오와 정확히 일치하는 취약점을 가지고 있었다.  
반면, Grammarly 서비스의 사례는 프로토콜을 안전하게 구현했더라도 백엔드의 예외 처리나 레거시 코드로 인해 어떻게 취약점이 발생할 수 있는지를 보여주는 더욱 흥미로운 케이스이다.

Grammarly는 원칙적으로 토큰이 외부로 노출되지 않는 `Authorization Code Grant Type`을 사용하고 있었다.  
그럼에도 불구하고 계정 탈취가 가능했는데, 그 원인은 과거 `Implicit Grant Type`을 사용하던 시절의 API 처리 로직을 레거시 코드 호환성을 위해 백엔드에 그대로 남겨둔 것에 있었다.  
공격자가 백엔드로 인가 코드를 전달하는 API 엔드포인트(예: `/auth`)에서 HTTP 요청 파라미터의 이름을 `code` 대신 `access_token`으로 변조하고 탈취한 토큰을 직접 전송하자, 백엔드의 예외 처리 로직이 이를 거르지 않고 수용해버린 것이다.

결과적으로 전달된 토큰에 대해 Audience 검증을 수행하지 않는 근본적인 결함과 맞물리면서, 겉으로는 안전한 Grant Type을 사용했음에도 동일한 계정 탈취라는 결과를 맞이했다.

---

## State 파라미터 검증 미흡 취약점

앞서 설명한 `Authorization Code Grant Type`플로우에서 클라이언트가 인가 요청을 보낼 때 선택적으로 포함할 수 있는 파라미터 중 `state`가 있었다.  
공식 문서([RFC 6749](https://rfc.keepwork.ing/rfc6749))에 따르면 이 파라미터는 요청과 콜백 간의 상태를 유지하고 CSRF(Cross-Site Request Forgery) 공격을 방어하기 위해 사용된다고 명시되어 있다.  
([How does the "state" parameter prevent CSRF in OAuth?](https://www.fwio.me/blog/oauth-state-param-explained) 글을 참고하면 state 파라미터의 구체적인 역할에 대해 이해하는데 도움 될 것이다.)

하지만 많은 개발자가 이 파라미터의 정확한 방어 원리를 이해하지 못해 값을 고정으로 넣거나, 반환된 `state` 값을 아예 검증하지 않는 실수를 범한다.

### 취약점 개요

일반적인 CSRF 공격이 피해자의 권한을 이용해 공격자가 원하는 악의적인 행위를 수행하게 만드는 것이라면, OAuth에서의 Login CSRF는 이와 반대로 피해자가 공격자의 계정으로 로그인되도록 만드는 현상을 의미한다.

일반적으로는 "피해자가 공격자의 계정으로 로그인된다면 오히려 공격자에게 손해 아닌가?"라고 생각할 수 있지만, 해당 취약점이 발생하는 서비스가 제공하는 기능의 성격에 따라 이는 매우 치명적인 결과를 초래한다.
![alt text](/review/2/image3.png)
### 공격 시나리오 분석

Login CSRF가 계정 탈취로 이어지는 시나리오를 통해 취약점을 분석해 보자.

1.  공격자의 Authorization Code 획득

공격자는 `state`를 검증하지 않는 타겟 서비스에 본인의 계정으로 로그인한 후, 'Google 계정 연동' 절차를 진행한다.

2. 연동 중단 및 코드 보관

공격자가 Google 로그인을 완료하면 인가 코드가 포함된 URL로 리다이렉트 되는데, 공격자는 이 최종 연동을 수행하지 않고 브라우저 툴 등을 이용해 반환된 Authorization Code를 가로채어 수집한다.

3. 악성 링크 생성 및 전달

공격자는 수집한 본인의 Authorization Code를 제출하는 콜백 URL(예: `https://target.com/callback?code=[공격자의_코드]`)을 생성하여 피해자에게 전송한다.  
이때 Authorization Code Grant Type의 콜백은 HTTP GET 메서드를 사용하므로, 공격자는 악성 링크를 직접 클릭하게 만드는 것 외에도 `<img>` 태그나 `<iframe>`태그의 `src` 속성에 삽입하여 피해자가 페이지에 접속하기만 해도 백그라운드에서 요청이 발생하도록 유도할 수 있다.

4.  피해자의 강제 연동

피해자가 타겟 서비스에 정상적으로 로그인되어 있는 상태에서 해당 링크(또는 이미지/프레임)에 접근하게 된다.

5.  계정 연동

타겟 서비스의 백엔드는 콜백으로 전달된 코드가 누구의 요청으로부터 시작된 것인지 검증하지 않고(`state` 검증 누락), 해당 코드를 Access Token으로 교환해 버린다. 그 결과, 피해자의 서비스 계정이 공격자의 Google 계정과 연동되어 버린다.

6.  계정 탈취 성공

이후 공격자는 타겟 서비스에서 "Google로 로그인"을 선택하여 본인의 Google 계정으로 인증을 수행하면, 피해자의 서비스 계정에 완전한 권한을 가지고 접근할 수 있게 된다.

### PKCE Downgrade

최근에는 이러한 코드 가로채기 및 CSRF 공격을 방어하기 위해 PKCE(Proof Key for Code Exchange) 방식이 표준으로 권고된다.  
PKCE는 인가 요청 시 해시된 `code_challenge`를 보내고, 토큰 교환 시 `code_verifier`를 보내어 두 요청이 동일한 클라이언트에서 발생했음을 암호학적으로 증명한다.  
만약 PKCE를 올바르게 구현하다면 `state` 파라미터 없이도 이 공격을 방어할 수 있다.

하지만 앞선 AccessToken Audience Claim 검증 미흡 취약점의 Grammarly 사례와 같이 레거시 시스템 호환성을 위해 PKCE 방식과 기존 Authorization Code 방식을 모두 허용하는 서비스라면 우회가 가능하다.  
IETF의 최신 보안 권고인 [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700)에서는 이를 PKCE Downgrade Attack이라고 정의한다.

만약 공격자가 시나리오 1단계에서 인가 요청을 보낼 때, 고의로 `code_challenge`와 `code_challenge_method` 파라미터를 요청에서 누락시켜 전송하였을 때 서버가 PKCE 사용을 강제하지 않는다면, 이 요청을 단순한 구형 Authorization Code 흐름으로 인식하고 `code_verifier` 없이도 동작하는 인가 코드를 발급해 버린다.  
결과적으로 PKCE의 방어 메커니즘이 무력화되며, 공격자는 훔친 코드를 이용해 동일하게 Login CSRF 공격을 성공시킬 수 있다.

---

## 대응 방안

지금까지 살펴본 두 가지 치명적인 취약점(Access Token 주입을 통한 계정 탈취, Login CSRF를 통한 계정 연동 악용)은 모두 프로토콜의 결함이 아닌, 클라이언트 구현 단계에서의 '검증 누락'에서 기인한다. 이를 방어하기 위한 핵심 대응 방안은 다음과 같다.

### Access Token 검증: Audience 확인의 의무화

토큰의 유효성을 검증할 때, 서명의 유효성이나 만료 여부만 확인해서는 안 된다.  
인가 서버로부터 발급받은 토큰이 '우리 서비스를 위해 발급된 토큰이 맞는지'를 확인하는 Audience Claim검증 절차가 반드시 포함되어야 한다.

### State 검증 및 PKCE 강제: 세션 바인딩과 다운그레이드 방어

Authorization Code가 전달되는 콜백 엔드포인트는 외부의 공격자가 개입하기 가장 쉬운 지점이다.

State 파라미터의 세션 바인딩 방식으로 인가 요청을 보낼 때 유추할 수 없는 난수를 생성하여 `state` 파라미터에 담고, 이를 사용자의 브라우저 세션에 안전하게 저장해야 한다.  
이후 콜백으로 돌아온 `state` 값과 세션에 저장된 값을 엄격하게 비교하여, 일치하지 않을 경우 인증 플로우를 즉시 중단해야 한다.

또한 PKCE 검증을 강제하여 레거시 호환성을 핑계로 `code_challenge` 없는 요청을 허용해서는 안 된다.  
인가 요청 시 `code_challenge`가 없었다면, 토큰 교환 시 `code_verifier`를 요구하는 검증을 우회할 수 없도록 서버 단에서 PKCE 사용을 강제하여 PKCE Downgrade 공격을 방어해야 한다.

---

## 마치며

본 글에서 분석한 취약점들은 공식 RFC 문서와 프로토콜의 보안 가이드라인을 정확히 이해하고 구현한다면 모두 방어할 수 있는 문제들이다.  
토큰 탈취에 취약하다고 알려진 `Implicit Grant Type`조차도, 전달받은 Token의 모든 Claim(특히 Audience)을 백엔드에서 철저하게 검증했다면 앞서 설명한 것과 같은 대규모 계정 탈취라는 심각한 취약점으로 이어지지는 않았을 것이다.

하지만 기술의 구현 단계와 검증 과정이 복잡해질수록, 개발자가 매뉴얼의 특정 문구를 간과하거나 예외 처리를 누락하는 실수를 범할 확률은 필연적으로 높아진다.

Grammarly의 사례처럼 레거시 코드를 유지하다가 우회 통로를 열어주거나, 소셜 계정 연동 기능에서 State 검증을 빠뜨리는 실수는 지금도 수많은 버그바운티 리포트에서 심심치 않게 찾아볼 수 있다.

이러한 실수를 방지하기 위한 OAuth/OIDC 프로토콜의 진화 방향을 살펴보면 흥미로운 점을 발견할 수 있다.

프로토콜과 Provider 측의 구현은 점점 더 고도화되고 복잡해지는 반면, 이를 가져다 쓰는 개발자가 직접 수행해야 하는 검증의 책임은 최대한 줄여주는 방향으로 발전하고 있다는 것이다.

Access Token 하나만으로 인증을 처리하던 방식에서 벗어나, 서명과 Audience 검증이 스펙으로 강제되는 OIDC의 `ID Token`을 도입한 것, 클라이언트 단에서 복잡한 State 검증 로직을 구현하는 대신 인가 서버 단에서 암호학적으로 흐름을 검증해 주는 `PKCE`가 표준으로 자리 잡고 있는 것이 그 대표적인 예라고 생각한다.

결국 안전한 OAuth/OIDC 아키텍처를 구축한다는 것은, 단순히 OAuth Provider의 API를 연동하는 것을 넘어 "우리가 신뢰하는 데이터(Token, Code)가 정말로 우리를 위해, 그리고 현재 요청을 보낸 사용자를 위해 발급된 것이 맞는가?"를 끊임없이 의심하고 검증하는 과정일 것이라는 생각이 든다.

마지막으로 이 글이 OAuth/OIDC를 구현하는 개발자들과 취약점을 분석하는 보안 연구자들에게 직관적인 이해를 돕는 작은 단서가 되기를 바란다.

---

> 참고자료  
> https://salt.security/blog/oh-auth-abusing-oauth-to-take-over-millions-of-accounts  
> https://rfc.keepwork.ing/rfc6749  
> https://datatracker.ietf.org/doc/html/rfc9700  
> https://www.igloo.co.kr/security-information/spring-security-part2-oauth-2-0-%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98-%EC%9D%B4%ED%95%B4%EC%99%80-%EB%B3%B4%EC%95%88-%EC%B7%A8%EC%95%BD%EC%A0%90-%EC%82%AC%EB%A1%80/  
> https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html  
> https://docs.cloud.google.com/docs/authentication/token-types?hl=ko#access-tokens  
> https://www.fwio.me/blog/oauth-state-param-explained  