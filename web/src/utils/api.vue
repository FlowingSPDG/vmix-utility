<script>
export default {
  name: "api",
  methods: {
    async GetvMixAddr() {
      try {
        const res = await this.axios.get("/api/vmix");
        return res.data.url;
      } catch (err) {
        throw new Error(err);
      }
    },
    async GetInputs() {
      try {
        const res = await this.axios.get("/api/inputs");
        return res.data.inputs;
      } catch (err) {
        throw new Error(err);
      }
    },
    async RefreshInput() {
      try {
        const res = await this.axios.post("/api/refresh");
        return res.data.inputs;
      } catch (err) {
        throw new Error(err);
      }
    },
    async TryFunction(url){
      try{
        await this.axios.get(url);
        await this.$notify({
          title: "Success",
          message: `Success GET Request on ${url}`,
          type: "success"
        });
      }catch(err){
        this.$notify.error({
          title: "Error",
          message: err
        })
      }
    },
    async SendsMultipleFunctions(funcName, queries, num){
      try{
        const data = {
          "function": funcName,
          "queries": queries,
          "num": num
        }
        const res = await this.axios.post("/api/multiple", data);
        await this.$notify({
          title: "Success",
          message: `Success POST multiple function Request`,
          type: "success"
        });
      }catch(err){
        this.$notify.error({
          title: "Error",
          message: err
        })
      }
    }
  }
};
</script>