[![CircleCI](https://circleci.com/gh/FlowingSPDG/vmix-utility.svg?style=shield)](https://circleci.com/gh/FlowingSPDG/vmix-utility)  
## vmix-utility
vMix utility tool, this can be used for managing inputs, checking multiviews and etc.  
Golang, Gin and Vue.  

## Developer / 開発者
Nil Hiiragi / 柊木にる
Github : [**FlowingSPDG**](http://github.com/FlowingSPDG)  
Twitter : [**@HiiragiNil**](http://twitter.com/HiiragiNil) / [**@rjzefl**](http://twitter.com/rjzefl) / [**@FlowingSPDG**](http://twitter.com/FlowingSPDG)

## Usage / 使い方
``./vmix_gen.exe -addr :8080 -vmix "http://localhost:8088" ``  
``-addr`` Specifies where to listen request from browser. Default: `:8080` / ブラウザからのリクエストを受け付けるポートを指定します。初期値: `":8080"`  
``-vmix`` : vMix API Endpoint URL. Default: `"http://localhost:8088"` / vMixのAPIエンドポイントURLです。初期値: `"http://localhost:8088"`

![Screenshot1](https://user-images.githubusercontent.com/30292185/111716922-5e197580-889a-11eb-91d1-059b63ff5e1f.png "Screenshot")  
![Screenshot2](https://user-images.githubusercontent.com/30292185/111715113-7d160880-8896-11eb-9a16-6af241f606b0.png "Screenshot")  

## Query Options
#### [Function name(vMix Reference)](https://www.vmix.com/help24/index.htm?WebScripting.html)
Specifies `Function` query in URL parameter.  
URL中の`Function`クエリパラメタを設定します。  
#### Value
Specifies `Value` query in URL parameter. currently this appears even tho `Function` does NOT support `Value` option.  
URL中の`Value`クエリパラメタを設定します。 現在は指定した`Function`が`Value`に対応していなくても表示されます。  
#### Input
Specifies `Input` query by input key. will be ignored if `"None"` specified.  
URL中の`Input`クエリパラメタをInput keyで指定します。 `"None"`が指定された場合無視されます。  
#### Query
Click [Add query] Button to add additional queries. e.g. If you add ``"Duration"``, and ``"500"``. This will add ``&Duration=500`` query in URL.  
[Add query] ボタンをクリックするとURL中にクエリを追加します。 例えば``”Duration"``,``"500"``を指定した場合``&Duration=500`` というクエリが追加されます。
  
  
## Releases  / ダウンロード
https://github.com/FlowingSPDG/vmix-utility/releases
