package vmixgo

// DataSourceAutoNextOff Name of the Data Source, Table Name(optional) 2args or comma separated??
func (v *Vmix) DataSourceAutoNextOff(nametable string) error {
	params := make(map[string]string)
	params["Value"] = nametable
	return v.SendFunction("DataSourceAutoNextOff", params)
}

// DataSourceAutoNextOn Name of the Data Source, Table Name(optional) 2args or comma separated??
func (v *Vmix) DataSourceAutoNextOn(nametable string) error {
	params := make(map[string]string)
	params["Value"] = nametable
	return v.SendFunction("DataSourceAutoNextOn", params)
}

// DataSourceAutoNextOnOff Name of the Data Source, Table Name(optional) 2args or comma separated??
func (v *Vmix) DataSourceAutoNextOnOff(nametable string) error {
	params := make(map[string]string)
	params["Value"] = nametable
	return v.SendFunction("DataSourceAutoNextOnOff", params)
}

// DataSourceNextRow Name of the Data Source, Table Name(optional) eg 'Excel/CSV,Shee1'
func (v *Vmix) DataSourceNextRow(nametable string) error {
	params := make(map[string]string)
	params["Value"] = nametable
	return v.SendFunction("DataSourceNextRow", params)
}

// DataSourcePreviousRow Name of the Data Source, Table Name(optional) eg 'Excel/CSV,Shee1'
func (v *Vmix) DataSourcePreviousRow(nametable string) error {
	params := make(map[string]string)
	params["Value"] = nametable
	return v.SendFunction("DataSourcePreviousRow", params)
}

// DataSourceSelectRow Name of the Data Source, Table Name(optional) and Row Index starting from 0 eg 'Excel/CSV,Sheet1,5'
func (v *Vmix) DataSourceSelectRow(nametableindex string) error {
	params := make(map[string]string)
	params["Value"] = nametableindex
	return v.SendFunction("DataSourceSelectRow", params)
}
