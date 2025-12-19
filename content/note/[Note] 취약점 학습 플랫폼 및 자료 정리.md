+++
date = '2025-11-27T14:55:59+09:00'
draft = false
title = '[Note] 취약점 학습을 위한 보안 리소스 정리'
summary = "정보보안 취약점 학습에 필요한 주요 플랫폼·VM·레퍼런스를 한눈에 정리한 자료"
toc = true
tags = ["Security Guide", "Security Resources"]
+++

---

## 들어가며

정보보안 분야에서는 모의해킹이나 취약점 진단과 같은 실무 목적 외에도, 개인적인 호기심, 학습, 연구를 위해 취약점을 탐구하는 경우가 많다.  
그러나 다른 기술 분야에 비해 해킹·취약점 관련 자료는 접근성이 낮은 편이다.

유익한 자료는 여러 플랫폼과 커뮤니티에 흩어져 있으며, 일부는 폐쇄적인 환경에 존재하거나 비공식적으로 공유되기도 한다.

이에 따라 본 글에서는 실무 및 학습 목적 모두에 활용 가능한 취약점 관련 리소스를 조사·정리하여, 플랫폼·VM·Box·도구 등을 한눈에 파악할 수 있는 참고용 위키 형태로 정리하고자 한다.

---

## 학습 플랫폼

취약점 학습에서 이론만으로는 한계가 있다.  
실제 서비스와 유사한 환경에서 취약점을 탐색하고, 원인을 분석하며, 공격 흐름을 끝까지 따라가보는 경험은 필수적이다.  
이러한 실습 중심 학습을 가능하게 하는 것이 Wargame, CTF, Box 환경 기반의 온라인 학습 플랫폼이다.

아래는 입문–중급 단계에서 널리 활용되는 대표적인 플랫폼들이다.

### Dreamhack

![image.png](/note/1/image.png)
*https://dreamhack.io/*

Dreamhack은 국내에서 가장 널리 알려진 정보보안 학습 플랫폼 중 하나다.  
강의, 워게임, CTF 등 보안 학습에 필요한 요소를 하나의 플랫폼에 통합해 제공하며, 대부분의 콘텐츠가 한글 기반으로 구성되어 있어 접근성이 높다.

웹 해킹, 시스템 해킹, 리버싱, 암호학 등 주요 보안 분야를 폭넓게 다루며, 브라우저 중심의 실습 환경을 제공해 별도의 로컬 세팅 부담이 적으며, 보안 개념 정리부터 웹 취약점 실습까지 한글 자료를 중심으로 체계적으로 학습하고 싶은 경우 적합한 선택지로 자주 언급된다.  
다만 실무 수준의 복합 시나리오나 최신 공격 기법을 깊게 다루기보다는, 기초 개념 이해와 입문 단계 학습에 초점이 맞춰져 있다는 평가도 있다.


### TryHackMe

![image.png](/note/1/image%201.png)
*https://tryhackme.com/*

TryHackMe는 입문자 친화적인 구조로 잘 알려진 해외 정보보안 학습 플랫폼이다.  
Room이라 불리는 단위별 학습 콘텐츠를 통해 이론 설명과 실습을 순차적으로 제공하며, 설명을 따라가며 직접 명령어를 실행해보는 방식으로 학습이 진행된다.

리눅스 기초, 네트워크, 웹 해킹, 시스템 보안, Active Directory 기초 등 보안 전반의 기본기를 폭넓게 다루고 있으며, 브라우저 또는 VPN 기반 환경을 통해 비교적 쉽게 접근할 수 있다.

보안 지식이 거의 없는 상태에서 실습을 통해 전체 흐름을 익히고 싶은 입문자나, CTF·Box 환경에 들어가기 전 기초를 다지고 싶은 경우에 적합하다고 알려져 있다.  
난이도는 전반적으로 낮은 편이며, 자율적인 취약점 분석이나 고난도 실무 시나리오는 제한적인 편이라는 의견도 있다.

### Hack The Box

![image.png](/note/1/image%202.png)
*https://www.hackthebox.com/*

Hack The Box는 실제 서비스와 유사한 환경에서의 공격 시나리오 실습에 초점을 둔 플랫폼이다.

취약한 시스템이나 서비스를 하나의 Box로 제공하며, 정보 수집부터 취약점 탐색, 권한 상승까지 전 과정을 학습자가 직접 설계해 해결해야 하는 구조를 갖고 있다.  
웹, 시스템, Active Directory, 클라우드 등 실무와 밀접한 영역을 폭넓게 다루며, VPN 기반 환경을 통해 내부망 침투 테스트와 유사한 경험을 제공한다.  
단계별 가이드보다는 자율적인 문제 해결을 요구하기 때문에 기본적인 리눅스·네트워크 지식과 공격 흐름에 대한 이해가 있는 학습자에게 더 적합하다는 평가가 많다.

완전 입문 단계에서는 난이도가 높게 느껴질 수 있어, TryHackMe 등 튜토리얼 중심 플랫폼을 선행하는 경우가 많다.

### PortSwigger Web Security Academy

![image.png](/note/1/image%203.png)
*https://portswigger.net/web-security*

PortSwigger Web Security Academy는 Burp Suite 개발사인 PortSwigger에서 제공하는 무료 웹 보안 학습 플랫폼이다.  
XSS, SQL Injection 같은 기본 취약점부터 논리적 버그, 고급 웹 공격 기법까지 실습형 랩을 통해 학습할 수 있도록 구성되어 있다.

각 주제는 개념 설명 → 데모 또는 요약 → 인터랙티브 랩의 흐름으로 진행되며, 난이도가 명시되어 있어 단계적으로 학습하기 좋다.  
완전 무료이면서도 커리큘럼이 체계적이기 때문에 웹 해킹 학습의 표준 코스로 자주 언급되며, 버그바운티나 웹 취약점 분석, 웹 레드팀 포지션을 준비하는 사람들에게 필수 리소스로 추천되는 경우가 많다.

웹 애플리케이션 보안에 특화된 플랫폼이므로 시스템 해킹이나 네트워크 전반을 다루기에는 범위가 제한적이다.

---

## VM/Box 실습 리소스

기본적인 취약점 개념과 공격 흐름을 익혔다면, 보다 실제 환경에 가까운 조건에서 직접 적용해보는 단계가 필요하다.  
실제 운영 중인 서비스를 대상으로 테스트를 수행하는 것은 법적·윤리적 제약이 크기 때문에, 이를 대체하기 위해 의도적으로 취약하게 설계된 VM·Box 리소스가 활용된다.

VM·Box 기반 실습 환경은 학습자가 환경 구성부터 공격 시나리오 설계까지 직접 주도해야 한다는 점에서 플랫폼형 서비스보다 실무에 가까운 경험을 제공한다.

### VulnHub

![image.png](/note/1/image%204.png)
*https://www.vulnhub.com/  
https://github.com/vulhub/vulhub*

VulnHub는 의도적으로 취약하게 설계된 가상 머신 이미지를 무료로 제공하는 대표적인 저장소다.  
사용자는 VM 이미지를 다운로드해 로컬 가상화 환경에 배포한 뒤, 모의 침투 테스트 방식으로 스캔·취약점 분석·권한 상승을 수행한다.  
완전히 로컬 환경에서 실습이 이루어지기 때문에 네트워크 구성, 공격용 머신 세팅 등도 학습자가 직접 관리해야 한다.

자유도가 높고 제약이 적어 OSCP 준비나 실무 모의침투 연습용으로 자주 활용된다고 알려져 있다.  
반면 웹 기반 UI나 단계별 힌트는 제공되지 않으며, 가상화·네트워크에 대한 기본 이해가 요구된다.

### DVWA

![image.png](/note/1/image%205.png)
*https://github.com/digininja/DVWA*

DVWA(Damn Vulnerable Web Application)는 웹 취약점 학습을 목적으로 제작된 의도적으로 취약한 웹 애플리케이션이다.  
SQL Injection, XSS, Command Injection, File Upload, CSRF 등 대표적인 웹 취약점들을 기능별로 제공하며, 공격 원리를 직관적으로 확인할 수 있도록 구성되어 있다.

Security Level을 통해 단순 공격부터 방어 코드가 추가된 상황까지 단계적으로 연습할 수 있다는 점이 특징이다.  
개인 학습뿐 아니라 교육, 워크숍, 사내 보안 훈련에서도 널리 활용된다.

### OWASP Juice Shop

![image.png](/note/1/image%206.png)
*https://github.com/juice-shop/juice-shop*


DVWA나 WebGoat가 비교적 단순한 구조의 학습용 애플리케이션에 초점을 둔다면, Juice Shop은 SPA(Single Page Application) 기반의 실제 서비스와 유사한 구조를 갖고 있어 보다 현실적인 웹 공격 시나리오를 경험할 수 있도록 설계된 것이 특징이다.

프론트엔드는 Angular 기반, 백엔드는 Node.js로 구성되어 있으며, REST API, JWT 인증, 클라이언트 사이드 로직, 비즈니스 로직 취약점 등 현대 웹 서비스에서 자주 등장하는 공격 표면을 폭넓게 다룬다.

SQL Injection, XSS 같은 전통적인 취약점뿐 아니라, Broken Access Control, 인증·인가 오류, 논리적 취약점, 클라이언트 사이드 보안 이슈 등 OWASP Top 10 전반을 실습 형태로 포함하고 있으며, “Challenge” 기반 구조를 제공해 각 취약점이 문제 형태로 제시되어, 공격 성공 여부를 애플리케이션 자체에서 검증할 수 있도록 설계되어 있다.

### WebGoat

![image.png](/note/1/image%207.png)
*https://github.com/WebGoat/WebGoat*

WebGoat는 OWASP에서 제공하는 웹 보안 교육용 애플리케이션으로, 취약점의 원인과 방어 방법까지 함께 이해하는 데 초점을 둔다.  
단계별 레슨 구조를 통해 OWASP Top 10 중심의 취약점을 체계적으로 학습할 수 있으며, 개념 학습과 보안 설계 이해에 특히 적합하다는 평가가 많다.

---

## 유용한 Github Respositories

취약점 학습 과정에서 GitHub는 단순한 코드 저장소를 넘어, 공격 기법·페이로드·도구 구현 방식·실무 관행이 축적된 중요한 참고 자료로 활용된다.  
다양한 해킹 도구와 페이로드, 치트시트, 학습용 코드들이 GitHub를 통해 공개되어 있으며, 실무자와 연구자가 실제로 어떤 방식으로 취약점을 분석하고 자동화하는지를 엿볼 수 있다.

다만 GitHub에 공개된 리포지토리는 품질과 목적이 매우 다양하다.  
실습·연구 목적에 적합한 자료도 있는 반면, 맥락 없이 사용될 경우 오해나 오용의 소지가 있는 코드 역시 존재한다.

### PayloadsAllTheThings

![image.png](/note/1/image%208.png)
*https://github.com/swisskyrepo/PayloadsAllTheThings*

PayloadsAllTheThings는 다양한 취약점 유형별로 공격 페이로드, 우회 기법, 참고 자료를 체계적으로 정리한 GitHub 리포지토리다.

XSS, SQL Injection, Command Injection, SSTI, File Upload, SSRF, Deserialization 등 웹 애플리케이션에서 자주 다뤄지는 취약점들이 항목별로 분류되어 있으며, 각 취약점마다 기본적인 페이로드 예시부터 필터 우회, 환경별 변형, 추가 참고 링크까지 함께 정리되어 있다.

이 리포지토리의 가장 큰 특징은 단일 도구나 자동화 스크립트가 아니라, 공격 아이디어와 패턴을 모아둔 레퍼런스라는 점이다. 즉, 그대로 복사해 사용하는 목적보다는 취약점 유형별 입력 패턴 파악, 필터링·인코딩·환경 차이에 따른 우회 방식 이해, 실습 중 막혔을 때의 참고 자료로 활용되는 경우가 많다.

또한 각 섹션에는 관련 문서, 블로그, 연구 자료 링크가 함께 포함되어 있어 단순 페이로드 모음이 아니라 추가 학습의 출발점 역할을 한다는 평가를 받는다.  
학습 과정에서는 “이 페이로드가 왜 동작하는가”, “어떤 전제 조건이 필요한가”를 함께 확인하지 않으면 취약점의 구조를 오해할 수 있으므로 주의가 필요하다.

### SecLists

![image.png](/note/1/image%209.png)
*https://github.com/danielmiessler/SecLists*

SecLists는 보안 테스트와 취약점 분석 과정에서 자주 활용되는 워드리스트(wordlist)·패턴 리스트를 체계적으로 정리한 GitHub 리포지토리다.  
페이로드 자체를 모아둔 저장소라기보다는, 브루트포스·퍼징·디렉터리 탐색·파라미터 탐색 등 입력 공간을 넓게 탐색해야 하는 상황에서 사용되는 기준 데이터 집합에 가깝다.

SecLists의 강점은 범용적인 리스트부터, 특정 기술 스택·상황에 특화된 리스트까지 폭넓게 제공한다는 점이다.  
단순히 “많은 값을 넣어본다”는 의미를 넘어서, 실제 환경에서 자주 등장하는 경로·이름·패턴을 기반으로 구성되어 있어 효율적인 탐색을 돕는 자료로 평가된다.

### hackingtool

![image.png](/note/1/image%2010.png)
*https://github.com/Z4nzu/hackingtool*

이 리포지토리는 여러 개별 오픈소스 보안 도구를 한꺼번에 모아두고, 메뉴 기반으로 실행할 수 있도록 한 Python 기반 도구 세트다.  
포함된 도구들은 정보 수집, 무선 공격, SQL Injection, 피싱 도구, 웹 공격, 후속 공격(Post-exploitation), 익스플로잇 프레임워크, DDoS, XSS, 해시 크래킹, 스테가노그래피 등 매우 폭넓은 카테고리를 다룬다.

이처럼 한 곳에서 여러 도구를 실행할 수 있다는 점이 장점이지만, 개별 도구의 목적·의도·사용법을 명확히 이해하지 않고 무작정 활용하는 것은 위험할 수 있다.  
특히 도구의 성격이 “공격용”인 항목이 많아 학습 목적이라도 대상 환경과 법적/윤리적 경계를 명확히 해야 한다.

### Awesome Hacking

![image.png](/note/1/image%2011.png)
*https://github.com/Hack-with-Github/Awesome-Hacking*

Awesome-Hacking은 해킹·정보보안 분야 전반에 걸친 학습 자료, 도구, 레퍼런스를 주제별로 정리한 메타형 GitHub 리포지토리다.

웹 해킹, 버그바운티, CTF, 리버싱, 익스플로잇 개발, 퍼징, 모바일 보안,사고 대응(IR), 무선 보안, YARA 등 정보보안 전반의 다양한 분야가 카테고리 단위로 정리되어 있으며, 각 항목은 다시 개별 리포지토리나 문서로 연결된다.  
이 리포지토리의 핵심 가치는 “무엇을 써야 하는가”를 알려주기보다, “어떤 분야에 어떤 자료들이 존재하는가”를 보여준다는 점에 있다.

따라서 특정 도구의 사용법을 바로 익히기보다는, 보안 분야 전반의 지형을 파악하거나, 관심 분야를 정하고 추가 학습 리소스를 탐색하거나, 학습 로드맵을 설계하는 단계에서 참고용 허브로 활용되는 경우가 많다.

### Infosec_Reference

![image.png](/note/1/image%2012.png)
*https://github.com/rmusser01/Infosec_Reference*

Infosec_Reference는 정보보안 전반에 대한 참고 자료, 기술·도구·공격 기법, 취약점 범주, 학습 리소스 등을 폭넓게 정리한 GitHub 리포지토리로, 보안 분야의 “Yellow Pages” 역할을 목표로 한다.  
프로젝트의 목표는 정보보안에 관심 있는 누구나 참고할 수 있는 무료 레퍼런스를 제공하는 것이며, 다양한 주제에 걸친 링크·기법·개념을 한 곳에 모아두고 있다.

nfosec_Reference의 가장 큰 특징은 정보보안의 전반적인 지형을 훑어보고, 추가 리서치나 학습으로 이어갈 수 있는 출발점을 제공한다는 점이다.  
각 카테고리는 다시 관련된 링크나 개념 자료로 이어지며, 기법 이름, 도구 링크, 학습/참고 자료같은 형태로 구분되어 있다.

이러한 구조는 “어떤 개념이 어디에 속하는지 모르겠다”, “관련 도구와 참고 링크를 빠르게 찾고 싶다”는 학습 초기 단계에서 특히 유용한 개념 인덱스 역할을 한다.

---

## 마치며
본 글에서는 취약점 학습 과정에서 자주 활용되는 온라인 학습 플랫폼, VM·Box 기반 실습 리소스, 그리고 GitHub 레퍼런스 리포지토리들을 학습·리서치 관점에서 정리했다.  
완결된 가이드라기보다는 향후 실습 경험과 추가 리서치에 따라 계속 보완될 수 있는 참고용 위키 형태의 정리를 목표로 한다.

취약점 학습을 처음 시작하는 사람이나, 이미 공부를 진행 중이지만 자료 정리에 어려움을 느끼는 사람에게 이 글이 하나의 출발점이나 참고 목록으로 활용되기를 바란다.

---

> 참고자료  
> https://blog.naver.com/skinfosec2000/220482083641  
> https://dreamhack.io/  
> https://www.vulnhub.com/  
> https://tryhackme.com/resources/blog/tryhackme-vs-hackthebox-in-2025-which-platform-should-beginners-choose  
> https://portswigger.net/web-security  
> https://blog.naver.com/chogar/221574113113  
> https://sourceforge.net/projects/owaspbwa/  
> https://tryhackme.com/  
> https://www.hackthebox.com/  
> https://www.youtube.com/channel/UCa6eh7gCkpPo5XXUDfygQQA  
> https://owasp.org/www-project-webgoat/  
> https://github.com/WebGoat/WebGoat  
> https://swisskyrepo.github.io/PayloadsAllTheThings/  
> https://github.com/swisskyrepo/PayloadsAllTheThings  
> https://github.com/danielmiessler/SecLists  
> https://owasp.org/www-project-juice-shop/  
> https://github.com/juice-shop/juice-shop  
> https://github.com/Hack-with-Github/Awesome-Hacking  
> https://github.com/rapid7/metasploit-framework  
> https://juice-shop.herokuapp.com/  
> https://github.com/rmusser01/Infosec_Reference  
> https://rmusser.net/docs/#/  