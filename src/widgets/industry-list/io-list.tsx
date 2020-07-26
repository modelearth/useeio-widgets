import * as React from "react";
import * as ReactDOM from "react-dom";

import { Widget, Config } from "../../widget";
import { Model, Matrix, Sector } from "../../webapi";
import { ListHeader } from "./list-header";

export class IOList extends Widget {

    config: Config;
    A: Matrix;
    sectors: Sector[];
    sectorIndex: { [code: string]: number };

    constructor(
        private model: Model,
        private direction: "inputs" | "outputs",
        private selector: string) {
        super();
        this.ready();
    }

    protected async handleUpdate(config: Config) {
        this.config = config;
        if (!this.A) {
            await this.initFields();
        }
        ReactDOM.render(
            <Component widget={this} />,
            document.querySelector(this.selector));
    }

    private async initFields() {
        const rawSectors = await this.model.sectors();
        const rawA = await this.model.matrix("A");
        const isMultiRegional = await this.model.isMultiRegional();
        if (!isMultiRegional) {
            this.A = rawA;
            this.sectors = rawSectors;
        } else {
            const { index, sectors } = await this.model.singleRegionSectors();
            this.sectors = sectors;

            // we aggregate the m*m multi-regional matrix to a n*n single
            // region matrix
            const m = rawSectors.length;
            const n = sectors.length;
            this.A = Matrix.zeros(n, n);
            for (let rawRow = 0; rawRow < m; rawRow++) {
                const rowCode = rawSectors[rawRow].code;
                const row = index[rowCode];
                if (row === undefined) {
                    continue;
                }
                for (let rawCol = 0; rawCol < m; rawCol++) {
                    const val = rawA.get(rawRow, rawCol);
                    if (!val) {
                        continue;
                    }
                    const colCode = rawSectors[rawCol].code;
                    const col = index[colCode];
                    if (col === undefined) {
                        continue;
                    }
                    const sum = this.A.get(row, col) + val;
                    this.A.set(row, col, sum);
                }
            }
        }

        // calculate the sector index that maps the sector codes
        // to the corresponding matrix indices
        this.sectorIndex = {};
        this.sectors.reduce((idx, sector) => {
            idx[sector.code] = sector.index;
            return idx;
        }, this.sectorIndex);
    }

}

const Component = (props: { widget: IOList }) => {

    const [config, setConfig] = React.useState<Config>({
        ...props.widget.config
    });

    return (
        <>
            <table>
                <thead>
                    <tr className="indicator-row">
                        <ListHeader
                            config={config}
                            sectorCount={0}
                            onConfigChange={newConfig => setConfig(
                                { ...config, ...newConfig })}
                            onSearch={_term => { }}
                        />
                    </tr>
                </thead>
            </table>
        </>
    );
};