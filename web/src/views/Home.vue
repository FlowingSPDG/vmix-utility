<template>
  <div class="home">
    <el-form ref="form" :model="form" label-width="120px">
      <el-form-item label="Function name">
        <el-input v-model="form.name"></el-input>
        <el-button round icon="el-icon-refresh-right" @click="form.name = ''">CLEAR</el-button>
      </el-form-item>

      <el-form-item label="Value">
        <el-input v-model="form.value"></el-input>
        <el-button round icon="el-icon-refresh-right" @click="form.value = ''">CLEAR</el-button>
      </el-form-item>

      <el-form-item label="Input">
        <el-select v-model="form.input" filterable >
          <el-option label="None" value=""></el-option>
          <el-option
            v-for="(input,index) in inputs"
            :key="index"
            :label="input.Number + ' : ' + input.Title"
            :value="input.Key"
          ></el-option>
        </el-select>
        <el-button
        round
        icon="el-icon-copy-document"
        v-clipboard:copy="form.input"
        v-clipboard:success="onCopy"
        v-clipboard:error="onError"
      >COPY</el-button>
      <el-button round icon="el-icon-refresh-right" @click="form.input = ''">CLEAR</el-button>
      </el-form-item>

      <el-form-item label="Custom queries" v-if="form.queries.length > 0">

        <query v-for="(query,index) in form.queries" :key="'key_'+index" v-model="form.queries[index]"> </query>

        <el-button round icon="el-icon-refresh-right" @click="form.queries = []">Flush queries</el-button>

      </el-form-item>

      <el-button round icon="el-icon-refresh-right" @click="Refresh">Refresh inputs</el-button>

      <el-button
        round
        icon="el-icon-copy-document"
        v-clipboard:copy="URL"
        v-clipboard:success="onCopy"
        v-clipboard:error="onError"
      >COPY</el-button>

      <el-button round icon="el-icon-circle-plus-outline" @click="AddQuery()">Add query</el-button>

      <el-input :placeholder="URL" readonly></el-input>

      <el-button round icon="el-icon-video-play" @click="TryFunction(URL)">Try!</el-button>
    </el-form>
  </div>
</template>

<script>
// @ is an alias to /src
import query from '@/components/query.vue'

export default {
  name: "Home",
  components: {
    query
  },
  data() {
    return {
      vMixURL: "",
      inputs: [],
      form: {
        name: "",
        input: "",
        value: "",
        queries:[] // {"key":"","value":""}
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
    AddQuery: function(){
      this.form.queries.push({"key":"","value":""})
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
      if (this.form.queries){
        for (let i=0;i<this.form.queries.length;i++){
          if (this.form.queries[i].key && this.form.queries[i].value){
            url += `&${this.form.queries[i].key}=${this.form.queries[i].value}`
          }
        }
      }
      return url;
    }
  }
};
</script>
