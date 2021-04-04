<template>
  <div class="duplicater">
    <h1>Blank Duplicater</h1>
    <el-checkbox v-model="transparent">Transparent Background</el-checkbox>
    <br>
    <el-input-number v-model="num" :min="1" :max="999"></el-input-number>
    <el-input v-loading.fullscreen.lock="fullscreenLoading" v-model="sourceInputKey" ></el-input>
    <br>
    <el-alert center title="大量のBlank生成はvMixへの過負荷、クラッシュを誘発する場合があります。" type="warning"></el-alert>
    <el-alert center title="実際に生成されるBlankは指定した数より少なくなる場合があります。" type="warning"></el-alert>
    <el-alert center title="Crop is not supported yet." type="warning"></el-alert>
    <el-popconfirm @onConfirm="Send()" title="続行しますか？">
      <el-button slot="reference">Confirm</el-button>
    </el-popconfirm>

  </div>
</template>

<script>
export default {
  data() {
    return {
      transparent: false,
      num: 1,
      sourceInputKey: "",
      fullscreenLoading: false
    };
  },
  methods:{
    async Send(){
      this.fullscreenLoading = true
      const queries = [{
        "key":"Value",
        "value":"Colour|Black"
      }]
      if (this.transparent) {
        queries.value = "Colour|Transparent"
      }
      try{
        return await this.SendsMultipleFunctions("AddInput", queries, this.num)
      }catch(e){
        // 
      }finally{
        this.fullscreenLoading = false
      }
    }
  }
}
</script>