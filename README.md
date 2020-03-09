# vmix-URL-Generator
vMix RESTful API URL Generator.  
Golang, gin and Vue.

## Author / 開発者
Shugo Kawamura / 河村 柊吾  
Github : [**FlowingSPDG**](http://github.com/FlowingSPDG)  
Twitter : [**@FlowingSPDG**](http://twitter.com/FlowingSPDG) / [**@FlowingSPDG_EN**](http://twitter.com/FlowingSPDG_EN)

## Usage / 使い方
``./vmix_gen.exe -addr :8080 -vmix "http://localhost:8088" ``  
``-addr`` Specifies where to listen request from browser. Default: `:8080` / ブラウザからのリクエストを受け付けるポートを指定します。初期値: `":8080"`  
``-vmix`` : vMix API Endpoint URL. Default: `"http://localhost:8088"` / vMixのAPIエンドポイントURLです。初期値: `"http://localhost:8088"`

![Screenshot](https://user-images.githubusercontent.com/30292185/76215841-e8c0a100-6252-11ea-808c-ef90566672f8.PNG "Screenshot")  

[Function name](https://www.vmix.com/help23/index.htm?WebScripting.html) : Specifies `Function` query in URL parameter. / URL中の`Function`クエリパラメタを設定します。  
Value : Specifies `Value` query in URL parameter. currently this appears even tho `Function` does NOT support `Value` option. / URL中の`Value`クエリパラメタを設定します。 現在は指定した`Function`が`Value`に対応していなくても表示されます。  
Input : Specifies `Input` query by input key. will be ignored if `"None"` specified. / URL中の`Input`クエリパラメタをInput keyで指定します。 `"None"`が指定された場合無視されます。