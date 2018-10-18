import { Application } from 'probot'

export = (app: Application) => {
  app.on('*', async context => {
    // context.log({ event: context.event, action: context.payload.action })

    context.log({ payload: context.payload })

    const { owner, repo } = context.repo()
    const { ref, sha } = context.payload.pull_request.head

    const file = `${ref}:README.md`

    let blobQuery = `
      query($owner: String!, $repo: String!, $file: String!) { 
        organization(login: $owner) {
          repository(name: $repo) {
            object(expression: $file) {
              ... on Blob {
                byteSize
              }
            }
          }
        }
      }
    `

    let blobQueryResult = await context.github.query(blobQuery, { owner, repo, file }) as any

    app.log(blobQueryResult)

    let byteSize = blobQueryResult.organization.repository.object.byteSize

    app.log(byteSize)

    let state: 'success' | 'failure';
    let description;

    if (byteSize > 10) {
      state = 'failure' as 'failure'
      description = 'File `README.md` exceeds file size limit of 10 bytes'
    } else {
      state = 'success' as 'success'
      description = 'No files exceed file size limit of 10 bytes'
    }

    const reposCreateStatusParams = {
      owner,
      repo,
      sha,
      state,
      target_url: 'https://github.com/steffen/file-size-checker',
      description,
      context: 'File Size Checker'
    }

    const createStatusResult = await context.github.repos.createStatus(reposCreateStatusParams)

    app.log(createStatusResult)
  })
}
