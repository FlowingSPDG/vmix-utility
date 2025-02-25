<template>
  <div class="blank_gen">
    <h1>Blank Input Generator</h1>
    <el-checkbox v-model="transparent">Transparent</el-checkbox>
    <br>
    <el-input-number v-loading.fullscreen.lock="fullscreenLoading" v-model="num" :min="1" :max="999"></el-input-number>
    <br>
    <el-alert
      center
      title="大量のBlank生成はvMixへの過負荷、クラッシュを誘発する場合があります。"
      type="warning">
    </el-alert>
    <el-alert
      center
      title="実際に生成されるBlankは指定した数より少なくなる場合があります。"
      type="warning">
    </el-alert>
    <el-button @click='SendConfirm()' title="続行しますか？">Confirm</el-button>

  </div>
</template>

<script>
export default {
  data() {
    return {
      transparent: false,
      num: 1,
      fullscreenLoading: false
    };
  },
  methods:{
    async SendConfirm(){
      try{
        await this.$confirm('続行しますか？', 'Warning', {
          confirmButtonText: 'OK',
          cancelButtonText: 'Cancel',
          type: 'warning'
        })
      }catch(e){
        return
      }
      this.fullscreenLoading = true
      const queries = [{
        "key":"value",
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