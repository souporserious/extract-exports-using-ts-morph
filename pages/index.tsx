import * as React from 'react'
import * as path from 'path'
import * as fs from 'fs'
import prettier from 'prettier/standalone'
import tsParser from 'prettier/parser-typescript'
import { Node, Project } from 'ts-morph'

const project = new Project({ useInMemoryFileSystem: true })

export default function App(props) {
  const [transformedCode, setTransformedCode] = React.useState('')
  const [identifier, setIdentifier] = React.useState('Box')
  const [exportedIdentifiers, setExportedIdentifiers] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const identifiers = []
    const sourceFile = project.createSourceFile('index.tsx', props.codeString)

    // Remove named exports: export { useHover } from 'hooks'
    sourceFile.getExportDeclarations().forEach((declaration) => {
      declaration.remove()
    })

    // Collect remaining exports and remove any declarations that don't have references
    sourceFile.getExportedDeclarations().forEach((declarations) => {
      declarations.forEach((declaration) => {
        if (
          Node.isExportableNode(declaration) ||
          Node.isExportGetableNode(declaration)
        ) {
          const name = declaration.getName()

          identifiers.push(name)

          if (name !== identifier) {
            const references = declaration.findReferences()
            if (references.length <= 1) {
              declaration.remove()
            }
          }
        }
      })
    })

    // Finally, fix missing references until we have an equal result
    let lastFullText

    while (lastFullText !== sourceFile.getFullText()) {
      lastFullText = sourceFile.getFullText()
      sourceFile.fixUnusedIdentifiers()
    }

    setExportedIdentifiers(identifiers)
    setTransformedCode(
      prettier.format(lastFullText, {
        parser: 'typescript',
        plugins: [tsParser],
      })
    )
    setLoading(false)

    return () => {
      project.removeSourceFile(sourceFile)
    }
  }, [identifier])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div style={{ overflow: 'auto' }}>
        <h4>Code String</h4>
        <pre>{props.codeString}</pre>
      </div>
      <div>
        <div>
          <h4>Extract</h4>
          <div>
            {exportedIdentifiers.map((exportIdentifier) => {
              const selected = exportIdentifier === identifier
              return (
                <button
                  key={exportIdentifier + selected}
                  disabled={loading}
                  onClick={() => {
                    setLoading(true)
                    setIdentifier(exportIdentifier)
                  }}
                  style={{
                    padding: '4px 8px',
                    border: 'none',
                    backgroundColor: selected ? '#1e9eff' : '#fffff',
                    color: selected ? '#ffffff' : '#000000',
                  }}
                >
                  {exportIdentifier}
                </button>
              )
            })}
          </div>
        </div>
        {loading ? (
          <div style={{ padding: 8 }}>Loading...</div>
        ) : (
          <pre>{transformedCode}</pre>
        )}
      </div>
    </div>
  )
}

export function getStaticProps() {
  const codeString = fs.readFileSync(
    path.resolve(process.cwd(), 'Example.tsx'),
    'utf-8'
  )
  return {
    props: { codeString },
  }
}
