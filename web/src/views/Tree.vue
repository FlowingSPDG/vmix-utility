<template>
  <div class="tree">
    <h1>Input Menu</h1>
    <el-button round icon="el-icon-refresh-right" @click="Refresh">Refresh inputs</el-button>
    <el-table ref="singleTable" :default-sort = "{prop: 'Number', order: 'ascending'}" :data="inputs" style="width:85%;margin:auto;" v-loading="loading">
      <el-table-column label="" type="expand">
        <template slot-scope="InputScope">
            <h1>Layers</h1>
            <el-table ref="singleTable" :default-sort = "{prop: 'Number', order: 'ascending'}" :data="InputScope.row.Overlay" style="width:85%;margin:auto;">
                <el-table-column label="Index" prop="Index"></el-table-column>
                <el-table-column label="Name"><template slot-scope="NameScope"> {{SolveInputNameByKey(NameScope.row.Key)}}</template></el-table-column>
                <el-table-column label="Key" prop="Key"></el-table-column>
            </el-table>

            <h1>Used By...</h1>
            <el-table ref="singleTable" :default-sort = "{prop: 'Number', order: 'ascending'}" :data="GetActiveUsedInputByKey(InputScope.row.Key)" style="width:85%;margin:auto;">
                <el-table-column label="Number"><template slot-scope="numScope"> {{SolveInputNumberByKey(numScope.row.Key)}}</template></el-table-column>
                <el-table-column label="Index"><template slot-scope="IndexScope">{{GetOverlayNumberByKey(IndexScope.row.Key,InputScope.row.Key)}}</template></el-table-column>
                <el-table-column label="Name"><template slot-scope="NameScope"> {{SolveInputNameByKey(NameScope.row.Key)}}</template></el-table-column>
                <el-table-column label="Key" prop="Key"></el-table-column>
            </el-table>
        </template>
      </el-table-column>
      <el-table-column label="Number" prop="Number" sortable> </el-table-column>
      <el-table-column label="Title" sortable>
            <template slot-scope="TitleScope">
                <el-input v-model="inputs[TitleScope.row.index].Title"></el-input>
                <el-button type="primary" :loading="false">Apply</el-button>
            </template>
      </el-table-column>
      <el-table-column label="Type" prop="SceneType" sortable> </el-table-column>
      <el-table-column label="Key" prop="Key"></el-table-column>
    </el-table>
  </div>
</template>


<script>
// @ is an alias to /src

export default {
  name: "InputMenu",
  components: {},
  data() {
    return {
        loading: false,
        inputs: []
    };
  },
  async mounted() {
        this.loading = true
        this.inputs = await this.GetInputs();
        this.loading = false
  },
  methods: {
      SolveInputNameByKey:function(key) {
          if (!Array.isArray(this.inputs)) {
              return
          }
          for (let i=0;i<this.inputs.length;i++) {
              if (this.inputs[i].Key == key) {
                  return this.inputs[i].Name
              }
          }
          return "NOT FOUND"
      },
      SolveInputNumberByKey:function(key) {
          if (!Array.isArray(this.inputs)) {
              return
          }
          for (let i=0;i<this.inputs.length;i++) {
              if (this.inputs[i].Key == key) {
                  return this.inputs[i].Number
              }
          }
          return 0
      },
      SolveInputNameByNumber:function(num) {
          if (!Array.isArray(this.inputs)) {
              return
          }
          for (let i=0;i<this.inputs.length;i++) {
              if (this.inputs[i].Number == num) {
                  return this.inputs[i].Name
              }
          }
          return "NOT FOUND"
      },
      GetActiveUsedInputByKey:function(key){
          if (!Array.isArray(this.inputs)) {
              return []
          }
          const UsingInputs = []
          for (let i=0;i<this.inputs.length;i++) {
              if (Array.isArray(this.inputs[i].Overlay)) {
                 for (let o=0;o<this.inputs[i].Overlay.length;o++) {
                    if (this.inputs[i].Overlay[o].Key == key) {
                        UsingInputs.push(this.inputs[i])
                    }
                }
              }
          }
          return UsingInputs
      },
      async Refresh(){
        this.loading = true
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
            })
        }finally{
            this.loading = false
        }
    },
    GetOverlayNumberByKey:function(InputKey,OverlayKey) {
        if (!Array.isArray(this.inputs)) {
            return
        }
        for (let i=0;i<this.inputs.length;i++) {
            if (this.inputs[i].Key == InputKey && Array.isArray(this.inputs[i].Overlay)) {
                for (let o=0;o<this.inputs[i].Overlay.length;o++) {
                    if (this.inputs[i].Overlay[o].Key == OverlayKey) {
                        return this.inputs[i].Overlay[o].Index
                    }
                }
              }
          }
    }
    },
  watch:{
  }
};
</script>
