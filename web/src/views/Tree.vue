<template>
  <div class="tree">
    <h1>Input Menu</h1>
    <el-table ref="singleTable" :default-sort = "{prop: 'Number', order: 'ascending'}" :data="inputs" style="width:85%;margin:auto;">
      <el-table-column label="Detail" type="expand">
        <template slot-scope="scope">
            <h1>Multi View</h1>
            <el-table ref="singleTable" :default-sort = "{prop: 'Number', order: 'ascending'}" :data="scope.row.Overlay" style="width:85%;margin:auto;">
                <el-table-column label="Index" prop="Index"></el-table-column>
                <el-table-column label="Name"><template slot-scope="scope"> {{SolveInputNameByKey(scope.row.Key)}}</template></el-table-column>
                <el-table-column label="Key" prop="Key"></el-table-column>
            </el-table>
        </template>
      </el-table-column>
      <el-table-column label="Number" prop="Number"> </el-table-column>
      <el-table-column label="Type" prop="SceneType" sortable> </el-table-column>
      <el-table-column label="Name" prop="Name" sortable> </el-table-column>
      <el-table-column label="Key" prop="Key"></el-table-column>
    </el-table>
  </div>
</template>


<script>
// @ is an alias to /src

export default {
  name: "Input Menu",
  components: {},
  data() {
    return {
        inputs: []
    };
  },
  async mounted() {
        this.inputs = await this.GetInputs();
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
      }
  },
  watch:{
  }
};
</script>
