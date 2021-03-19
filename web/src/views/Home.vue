<template>
  <div class="home">
    <h1>Function Generator</h1>
    <el-form ref="form" :model="form" label-width="120px">
      <el-form-item label="詳細モード">
        <el-checkbox v-model="DetailedMode"></el-checkbox>
      </el-form-item>

      <el-form-item label="Function name">
        <el-input v-model="form.name"></el-input>
        <el-button round icon="el-icon-refresh-right" @click="form.name = ''"
          >CLEAR</el-button
        >
      </el-form-item>

      <el-form-item label="vMix URL(Override)">
        <el-input placeholder="vMix Script" :value="vMixURLAddr()"></el-input>
        <el-input v-model="vMixURLOverride">
          <template slot="prepend">http://</template>
        </el-input>
        <el-button
          round
          icon="el-icon-refresh-right"
          @click="vMixURLOverride = ''"
          >CLEAR</el-button
        >
      </el-form-item>

      <el-form-item label="Value">
        <el-input v-model="form.value"></el-input>
        <el-button round icon="el-icon-refresh-right" @click="form.value = ''"
          >CLEAR</el-button
        >
      </el-form-item>

      <el-form-item label="Custom queries" v-if="form.queries.length > 0">
        <query
          v-for="(query, index) in form.queries"
          :key="'key_' + index"
          v-model="form.queries[index]"
        >
        </query>
        <el-button round icon="el-icon-refresh-right" @click="form.queries = []"
          >Flush queries</el-button
        >
      </el-form-item>

      <el-button round icon="el-icon-refresh-right" @click="Refresh"
        >Refresh inputs</el-button
      >
      <el-button round icon="el-icon-circle-plus-outline" @click="AddQuery()"
        >Add query</el-button
      >
    </el-form>

    <el-table
      ref="singleTable"
      :default-sort="{ prop: 'Number', order: 'ascending' }"
      :data="inputs"
      style="width: 85%; margin: auto"
      v-loading="loading"
      highlight-current-row
      @current-change="handleCurrentChange"
    >
      <el-table-column label="Number" prop="Number" sortable> </el-table-column>
      <el-table-column label="Name" prop="Name" sortable> </el-table-column>
      <el-table-column label="KEY" v-if="DetailedMode">
        <template slot-scope="scope">
          {{ scope.row.Key }}
          <el-button
            round
            icon="el-icon-copy-document"
            @click="setCurrent(scope.row.Number - 1)"
            v-show="scope.row.Key != ``"
            v-clipboard:copy="scope.row.Key"
            v-clipboard:success="onCopy"
            v-clipboard:error="onError"
            >Key</el-button
          >
        </template>
      </el-table-column>
      <el-table-column label="vMix functions" width="400">
        <template slot-scope="scope" style="">
          <el-input
            placeholder="vMix API URL"
            :value="URL(scope.row.Key)"
            v-if="DetailedMode"
          ></el-input>
          <el-input
            placeholder="vMix Script"
            :value="Script(scope.row.Key)"
            v-if="DetailedMode"
          ></el-input>
          <el-button-group>
            <el-button
              plain
              size="small"
              round
              icon="el-icon-copy-document"
              @click="setCurrent(scope.row.Number - 1)"
              v-clipboard:copy="URL(scope.row.Key)"
              v-clipboard:success="onCopy"
              v-clipboard:error="onError"
              >URL</el-button
            >
            <el-button
              plain
              size="small"
              round
              icon="el-icon-copy-document"
              @click="setCurrent(scope.row.Number - 1)"
              v-clipboard:copy="Script(scope.row.Key)"
              v-clipboard:success="onCopy"
              v-clipboard:error="onError"
              >Script</el-button
            >
            <el-button
            v-if="scope.row.Key !== ''"
              plain
              size="small"
              round
              icon="el-icon-video-camera"
              @click="openTally(TallyURL(scope.row.Key))"
              >Tally</el-button
            >
            <el-button
              plain
              size="small"
              round
              icon="el-icon-video-play"
              @click="
                TryFunction(URL(scope.row.Key));
                setCurrent(scope.row.Number - 1);
              "
              >Try!</el-button
            >
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
// @ is an alias to /src
import query from "@/components/query.vue";

export default {
  name: "Home",
  components: {
    query,
  },
  data() {
    return {
      vMixURL: "",
      vMixURLOverride: "",
      inputs: [],
      form: {
        name: "",
        input: "",
        value: "",
        queries: [], // {"key":"","value":""}
      },
      loading: false,
      DetailedMode: false,
      currentRow: null,
    };
  },
  async mounted() {
    this.loading = true;
    this.vMixURL = await this.GetvMixAddr();
    this.inputs = await this.GetInputs();
    this.loading = false;
  },
  methods: {
    onCopy: function (e) {
      this.$notify({
        title: "Success",
        message: `Copied ${e.text}`,
        type: "success",
      });
    },
    onError: function (e) {
      this.$notify.error({
        title: "Error",
        message: `Copy failed : ${e}`,
      });
    },
    AddQuery: function () {
      this.form.queries.push({ key: "", value: "" });
    },
    async Refresh() {
      try {
        this.inputs = await this.RefreshInput();
        this.$notify({
          title: "Success",
          message: `Refreshed inputs.`,
          type: "success",
        });
      } catch (err) {
        this.$notify.error({
          title: "Error",
          message: err,
        });
      }
    },
    URL: function (inputKey) {
      const vmix =
        this.vMixURLOverride != ""
          ? `http://${this.vMixURLOverride}`
          : this.vMixURL;
      let url = `${vmix}/api?Function=${this.form.name}`;
      if (inputKey) url += `&Input=${inputKey}`;
      if (this.form.value !== "") url += `&Value=${this.form.value}`;
      if (this.form.queries) {
        for (let i = 0; i < this.form.queries.length; i++) {
          if (this.form.queries[i].key && this.form.queries[i].value) {
            url += `&${this.form.queries[i].key}=${this.form.queries[i].value}`;
          }
        }
      }
      return url;
    },
    TallyURL: function (inputKey) {
      const vmix =
        this.vMixURLOverride != ""
          ? `http://${this.vMixURLOverride}`
          : this.vMixURL;
      const url = `${vmix}/tally?key=${inputKey}`;
      return url;
    },
    Script: function (inputKey) {
      let url = `Function=${this.form.name}`;
      if (inputKey) url += `&Input=${inputKey}`;
      if (this.form.value !== "") url += `&Value=${this.form.value}`;
      if (this.form.queries) {
        for (let i = 0; i < this.form.queries.length; i++) {
          if (this.form.queries[i].key && this.form.queries[i].value) {
            url += `&${this.form.queries[i].key}=${this.form.queries[i].value}`;
          }
        }
      }
      return url;
    },
    setCurrent(row) {
      this.$refs.singleTable.setCurrentRow(row);
    },
    handleCurrentChange(val) {
      this.currentRow = val;
    },
    vMixURLAddr() {
      return this.vMixURL;
    },
    openTally(url) {
      window.open(url, "_blank");
    },
  },
  watch: {
    inputs: function (val, oldval) {
      if (val[0].Key !== "") {
        this.inputs.unshift(
        {
          Number: null,
          Name: "EMPTY",
          Key: "",
        },
        {
          Number: -1,
          Name: "PREVIEW",
          Key: "-1",
        },
        {
          Number: 0,
          Name: "PROGRAM",
          Key: "0",
        }
        );
      }
    },
    deep: true,
  },
};
</script>
