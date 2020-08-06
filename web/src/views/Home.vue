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

      <el-form-item label="Custom queries" v-if="form.queries.length > 0">
        <query v-for="(query,index) in form.queries" :key="'key_'+index" v-model="form.queries[index]"> </query>
        <el-button round icon="el-icon-refresh-right" @click="form.queries = []">Flush queries</el-button>
      </el-form-item>

      <el-button round icon="el-icon-refresh-right" @click="Refresh">Refresh inputs</el-button>
      <el-button round icon="el-icon-circle-plus-outline" @click="AddQuery()">Add query</el-button>
    </el-form>

    <el-table ref="singleTable" :default-sort = "{prop: 'Number', order: 'ascending'}" :data="inputs" style="width:85%;margin:auto;" v-loading="loading" highlight-current-row @current-change="handleCurrentChange">
      <el-table-column label="Number" prop="Number" sortable> </el-table-column>
      <el-table-column label="Name" prop="Name" sortable> </el-table-column>
      <el-table-column label="KEY">
        <template slot-scope="scope">
          {{ scope.row.Key }}
          <el-button round icon="el-icon-copy-document" @click="setCurrent(scope.row.Number-1)" v-show="scope.row.Key != ``" v-clipboard:copy="scope.row.Key" v-clipboard:success="onCopy" v-clipboard:error="onError">COPY Key</el-button>
        </template>
      </el-table-column>
      <el-table-column label="vMix functions">
        <template slot-scope="scope">
          <el-input placeholder="vMIX API URL" :value="URL(scope.row.Key)"></el-input>
          <el-button round icon="el-icon-copy-document" @click="setCurrent(scope.row.Number-1)" v-clipboard:copy="URL(scope.row.Key)" v-clipboard:success="onCopy" v-clipboard:error="onError">COPY URL</el-button>
          <el-button round icon="el-icon-video-play" @click="TryFunction(URL(scope.row.Key));setCurrent(scope.row.Number-1)">Try!</el-button>
        </template>
      </el-table-column>
    </el-table>
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
      },
      loading:false,
      currentRow: null
    };
  },
  async mounted() {
    this.vMixURL = await this.GetvMixAddr();
    this.inputs = await this.GetInputs();
    this.loading = false
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
        message: `Copy failed : ${e}`
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
    },
    URL: function(inputKey) {
      let url = `${this.vMixURL}/api?Function=${this.form.name}`;
      if (inputKey) {
        url += `&Input=${inputKey}`;
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
    },
    setCurrent(row) {
      this.$refs.singleTable.setCurrentRow(row);
      setTimeout(() => {
       this.$refs.singleTable.setCurrentRow(null);
     },1000)
    },
    handleCurrentChange(val) {
     this.currentRow = val;
    }
  },
  watch:{
    inputs:function(val,oldval){
      if (val[0].Key !== "") {
        this.inputs.unshift({
          Number:0,
          Name:"EMPTY",
          Key:"",
        })
      }
    },
    deep: true
  }
};
</script>
