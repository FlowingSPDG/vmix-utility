<template>
  <div class="home">
    <el-form ref="form" :model="form" label-width="120px">
      <el-form-item label="Function name">
        <el-input v-model="form.name"></el-input>
      </el-form-item>

      <el-form-item label="Value">
        <el-input v-model="form.value"></el-input>
      </el-form-item>

      <el-form-item label="Input">
        <el-select v-model="form.input">
          <el-option label="None" value=""></el-option>
          <el-option
            v-for="(input,index) in inputs"
            :key="index"
            :label="input.Number + ' : ' + input.Title"
            :value="input.Key"
          ></el-option>
        </el-select>
      </el-form-item>

      <el-button round icon="el-icon-refresh-right" @click="Refresh">Refresh inputs</el-button>

      <el-button
        round
        icon="el-icon-copy-document"
        v-clipboard:copy="URL"
        v-clipboard:success="onCopy"
        v-clipboard:error="onError"
      >COPY</el-button>
      <el-input :placeholder="URL" readonly></el-input>
    </el-form>
  </div>
</template>

<script>
// @ is an alias to /src
// import HelloWorld from '@/components/HelloWorld.vue'

export default {
  name: "Home",
  // components: {
  //   HelloWorld
  // }
  data() {
    return {
      vMixURL: "",
      inputs: [],
      form: {
        name: "",
        input: "",
        value: ""
      }
    };
  },
  async mounted() {
    this.vMixURL = await this.GetvMixAddr();
    this.inputs = await this.GetInputs();
  },
  methods: {
    onCopy: function(e) {
      this.$notify({
        title: "Success",
        message: `Copied ${e.text}`,
        type: "success"
      });
    },
    onError: function(e) {
      this.$notify.error({
        title: "Error",
        message: `Copy failed`
      });
    },
    async Refresh(){
      try{
        this.inputs = await this.RefreshInput()
        this.$notify({
        title: "Success",
        message: `Refreshed inputs.`,
        type: "success"
      });
      }catch(err){
        this.$notify.error({
        title: "Error",
        message: err
      });
      }
    }
  },
  computed: {
    URL: function() {
      let url = `${this.vMixURL}/api?Function=${this.form.name}`;
      if (this.form.input !== "") {
        url += `&Input=${this.form.input}`;
      }
      if (this.form.value !== "") {
        url += `&Value=${this.form.value}`;
      }
      return url;
    }
  }
};
</script>
