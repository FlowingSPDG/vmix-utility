<script>
export default {
  name: "ApiHelper",
  methods: {
    async GetInputs() {
      try {
        const res = await this.axios.get("/api/inputs");
        return res.data.inputs;
      } catch (err) {
        throw new Error(err);
      }
    },
    async GetShortcuts() {
      try {
        const res = await this.axios.get("/api/shortcuts");
        return res.data;
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
        switch (res.status) {
          case 200:
            await this.$notify({
              title: "Success",
              message: res.data,
              type: "success"
            });
            break
          case 202:
            this.$notify({
              title: "Warning",
              message: res.data,
              type: "warning"
            })
            break
          default:
            this.$notify({
              title: "Error",
              message: res.data,
              type: "error"
          })
        }
      }catch(err){
        this.$notify({
          title: "Error",
          message: err,
          type: "warning"
        })
      }
    },
    async SetInputName(input, value) {
      try {
        const data = {
          "input": input,
          "value": value
        }
        const res = await this.axios.post("/api/setinputname", data);
        this.$notify({
          title: "Success",
          message: res.data.message || "Successfully set input name",
          type: "success"
        });
      } catch (err) {
        this.$notify.error({
          title: "Error",
          message: err.response?.data?.error || err.message || "Failed to set input name"
        })
        throw new Error(err);
      }
    }
  }
};
</script>